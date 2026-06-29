"""
AI-Sourcing Hub — Document Processing Celery Tasks

Background tasks for local OCR-based document extraction using
PaddleOCR PP-Structure (replaces external VLM API).

Pipeline:
    1. Fetch Document record from DB, update status → processing
    2. Download file bytes from MinIO
    3. Call ocr_client.extract_table_local() — handles both PDFs (all pages) and images
    4. Store extracted products in extracted_entities JSONB, status → extracted
    5. On extraction failure: status → failed, store error details
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import asyncio
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.shared.celery_app import celery_app
from app.shared.database import create_sync_session_factory
from app.shared.logging import get_logger
from app.modules.catalog.service import sync_document_products_sync
from app.modules.documents.models import (
    Document,
    DocumentStatus,
)
from app.modules.documents.ocr_client import extract_table_local
from app.shared.storage import download_file

# Import all cross-module models so SQLAlchemy can resolve string-based
# relationships (e.g., User.quotations → Quotation) before mapper config.
import app.modules.output.models  # noqa: F401
import app.modules.intake.models  # noqa: F401
import app.modules.auth.models    # noqa: F401

logger = get_logger(__name__)

# ═══════════════════════════════════════════════════════════
# Sync Database Session Factory (uses shared infrastructure)
# ═══════════════════════════════════════════════════════════
# Celery tasks run outside FastAPI's async context, so we need
# a synchronous SQLAlchemy session. Uses create_sync_session_factory()
# which properly parses the asyncpg URL via URL.create().

_sync_session_factory = create_sync_session_factory(
    pool_size=5,
    max_overflow=10,
)


def _get_session() -> Session:
    """Create a new sync DB session for Celery task usage."""
    return _sync_session_factory()


# ═══════════════════════════════════════════════════════════
# Celery Task
# ═══════════════════════════════════════════════════════════


@celery_app.task(
    bind=True,
    name="process_document_vision",
    acks_late=True,
    max_retries=3,
    default_retry_delay=30,
)
def process_document_vision(
    self,
    document_id: str,
    provider: Optional[str] = None,
) -> dict:
    """Process a document through local OCR extraction asynchronously.

    Uses PaddleOCR PP-Structure (local CPU, no external API calls).
    Handles both PDFs (all pages) and single images.
    The ``provider`` parameter is accepted for backward compatibility
    but is **ignored** — extraction is always local.

    Pipeline:
        1. Fetch Document record, update status → ``processing``
        2. Download file bytes from MinIO
        3. Call ``ocr_client.extract_table_local()`` — handles multi-page PDFs
        4. Store products in ``extracted_entities``, status → ``extracted``
        5. Sync extracted products into ``catalog_products`` (``sync_document_products_sync``)
        6. On any exception: status → ``failed``, store error message, then retry

    Args:
        document_id: UUID of the Document record.
        provider: Deprecated — ignored (local OCR always used).

    Returns:
        Dict with ``document_id``, ``status``, ``product_count``, and ``catalog_count``.
    """
    logger.info(
        "Processing document OCR task",
        extra={"document_id": document_id},
    )

    db: Session = _get_session()

    try:
        # ── Step 1: Fetch document & update status ──────────────
        doc = db.execute(
            select(Document).where(Document.id == uuid.UUID(document_id))
        ).scalar_one_or_none()

        if not doc:
            raise ValueError(f"Document {document_id} not found")

        doc.status = DocumentStatus.PROCESSING
        db.flush()
        logger.info(
            "Document status updated to processing",
            extra={"document_id": document_id},
        )

        # ── Step 2: Download file from MinIO ────────────────────
        file_bytes: Optional[bytes] = asyncio.run(
            download_file(
                key=doc.file_path,
                bucket=settings.STORAGE_BUCKET_DOCUMENTS,
            )
        )

        if not file_bytes:
            raise ValueError(
                f"File not found in storage: {doc.file_path}"
            )

        logger.info(
            "File downloaded from MinIO",
            extra={
                "document_id": document_id,
                "size_bytes": len(file_bytes),
                "file_path": doc.file_path,
            },
        )

        # ── Step 3: Run local PaddleOCR PP-Structure extraction ─
        # Handles both PDFs (all pages) and images internally
        extracted: list[dict] = asyncio.run(
            extract_table_local(
                file_bytes=file_bytes,
                file_name=doc.file_name,
            )
        )

        # ── Step 4: Store extracted products ────────────────────
        doc.extracted_entities = {"products": extracted}
        doc.extracted_text = str(extracted) if extracted else None
        doc.status = DocumentStatus.EXTRACTED
        db.flush()

        # ── Step 5: Sync products to catalog (sync version) ────
        catalog_count = sync_document_products_sync(db, doc)

        logger.info(
            "Document OCR extraction successful",
            extra={
                "document_id": document_id,
                "product_count": len(extracted),
                "catalog_count": catalog_count,
            },
        )

        db.commit()
        return {
            "document_id": document_id,
            "status": "extracted",
            "product_count": len(extracted),
            "catalog_count": catalog_count,
        }

    except Exception as exc:
        db.rollback()

        # ── Step 5: Update document status to failed ────────────
        try:
            doc = db.execute(
                select(Document).where(Document.id == uuid.UUID(document_id))
            ).scalar_one_or_none()
            if doc:
                doc.status = DocumentStatus.FAILED
                doc.error_message = str(exc)[:1000]
                db.commit()
        except Exception:
            db.rollback()

        logger.error(
            "Document OCR processing failed — will retry",
            extra={"document_id": document_id, "error": str(exc)},
        )

        # Celery's built-in retry (max_retries=3, delay=30s)
        raise self.retry(exc=exc)

    finally:
        db.close()

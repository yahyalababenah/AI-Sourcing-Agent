"""
AI-Sourcing Hub — Document Processing Celery Tasks

Background tasks for vision-based document extraction.

Pipeline:
    1. Fetch Document record from DB, update status → processing
    2. Download file bytes from MinIO
    3. Convert first PDF page to PNG (or use image as-is)
    4. Call vision_client.extract_table_from_image() (async → sync via asyncio.run)
    5. Run json_repair.repair_vision_json() on raw VLM response
    6. On success: validate rows, store in extracted_entities JSONB, status → extracted
    7. On parse failure: status → failed, store raw LLM output in error_message
    8. On API failure: status → failed, store error details
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import asyncio
import io
import uuid
from typing import Optional

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.shared.celery_app import celery_app
from app.shared.logging import get_logger
from app.modules.documents.models import (
    Document,
    DocumentStatus,
    DocumentType,
)
from app.modules.documents.vision_client import extract_table_from_image
from app.modules.documents.json_repair import repair_vision_json
from app.shared.storage import download_file

logger = get_logger(__name__)

# ═══════════════════════════════════════════════════════════
# Sync Database Engine for Celery Workers
# ═══════════════════════════════════════════════════════════
# Celery tasks run outside FastAPI's async context, so we need
# a synchronous SQLAlchemy engine. Convert asyncpg URL → psycopg2.
_sync_db_url = settings.db_url.replace(
    "postgresql+asyncpg", "postgresql"
).replace(
    "+asyncpg", ""
)

_sync_engine = create_engine(
    _sync_db_url,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,
)

_sync_session_factory = sessionmaker(bind=_sync_engine)


def _get_session() -> Session:
    """Create a new sync DB session for Celery task usage."""
    return _sync_session_factory()


# ═══════════════════════════════════════════════════════════
# Internal Helpers (sync versions for Celery context)
# ═══════════════════════════════════════════════════════════


def _map_to_media_type(content_type: str, file_name: str) -> str:
    """Map content type to media type for VLM."""
    if content_type and content_type.startswith("image/"):
        return content_type
    name_lower = file_name.lower()
    if name_lower.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if name_lower.endswith(".png"):
        return "image/png"
    if name_lower.endswith(".webp"):
        return "image/webp"
    return "image/png"  # default fallback


def _pdf_page_to_image(pdf_bytes: bytes, page_num: int = 0) -> bytes:
    """Convert a PDF page to a PNG image using pdf2image.

    Args:
        pdf_bytes: Raw PDF file bytes.
        page_num: Page number to convert (0-indexed).

    Returns:
        PNG image bytes.

    Raises:
        ValueError: If pdf2image is not installed or conversion fails.
    """
    try:
        from pdf2image import convert_from_bytes

        images = convert_from_bytes(
            pdf_bytes,
            first_page=page_num + 1,
            last_page=page_num + 1,
            fmt="png",
            dpi=200,
        )
        if not images:
            raise ValueError("PDF page conversion returned no images")
        buf = io.BytesIO()
        images[0].save(buf, format="PNG")
        return buf.getvalue()
    except ImportError:
        raise ValueError(
            "pdf2image is not installed. Install it for PDF processing."
        )
    except Exception as exc:
        raise ValueError(f"Failed to convert PDF to image: {exc}")


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
    """Process a document through vision extraction asynchronously.

    This Celery task runs outside FastAPI's async context, so all
    async service calls are wrapped via ``asyncio.run()``.

    Pipeline:
        1. Fetch Document record, update status → ``processing``
        2. Download file bytes from MinIO
        3. Convert first PDF page to PNG (or use image as-is)
        4. Call ``vision_client.extract_table_from_image()``
        5. Run ``json_repair.repair_vision_json()`` on raw VLM output
        6. On valid parse: store products in ``extracted_entities``, status → ``extracted``
        7. On parse failure: status → ``failed``, store raw output in ``error_message``
        8. On any exception: status → ``failed``, store error message, then retry

    Args:
        document_id: UUID of the Document record.
        provider: Optional vision provider override (e.g., "openrouter", "together").

    Returns:
        Dict with ``document_id``, ``status``, and ``product_count``.
    """
    logger.info(
        "Processing document vision task",
        extra={"document_id": document_id, "provider": provider},
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

        # ── Step 3: Convert PDF to image if needed ──────────────
        media_type = _map_to_media_type(
            doc.content_type or "", doc.file_name
        )

        if doc.doc_type == DocumentType.PDF:
            image_bytes = _pdf_page_to_image(file_bytes)
            media_type = "image/png"
            logger.info(
                "PDF converted to PNG",
                extra={"document_id": document_id},
            )
        else:
            image_bytes = file_bytes

        # ── Step 4: Call VLM ────────────────────────────────────
        raw_response: str = asyncio.run(
            extract_table_from_image(
                image_bytes=image_bytes,
                media_type=media_type,
                provider=provider,
            )
        )

        logger.info(
            "VLM response received",
            extra={
                "document_id": document_id,
                "response_length": len(raw_response),
            },
        )

        # ── Step 5: Repair / parse VLM JSON ─────────────────────
        extracted = repair_vision_json(raw_response)

        if extracted is not None:
            # ✅ Step 6: Valid parse → store results
            doc.extracted_entities = {"products": extracted}
            doc.extracted_text = str(extracted)
            doc.status = DocumentStatus.EXTRACTED
            db.flush()

            logger.info(
                "Document vision extraction successful",
                extra={
                    "document_id": document_id,
                    "product_count": len(extracted),
                },
            )

            result = {
                "document_id": document_id,
                "status": "extracted",
                "product_count": len(extracted),
                "provider": provider,
            }
        else:
            # ❌ Step 7: Parse failure → store raw output
            doc.status = DocumentStatus.FAILED
            doc.error_message = (
                "Failed to parse VLM response as valid product JSON. "
                "Raw output stored in extracted_text for manual review."
            )
            doc.extracted_text = raw_response  # ← store raw VLM output
            db.flush()

            logger.warning(
                "Document vision parsing failed — raw output saved",
                extra={"document_id": document_id},
            )

            result = {
                "document_id": document_id,
                "status": "failed",
                "error": doc.error_message,
                "provider": provider,
            }

        db.commit()
        return result

    except Exception as exc:
        db.rollback()

        # ── Step 8: Update document status to failed ────────────
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
            "Document vision processing failed — will retry",
            extra={"document_id": document_id, "error": str(exc)},
        )

        # Celery's built-in retry (max_retries=3, delay=30s)
        raise self.retry(exc=exc)

    finally:
        db.close()

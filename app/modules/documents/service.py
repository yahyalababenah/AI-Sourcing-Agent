"""
AI-Sourcing Hub — Document Service Layer

Handles file uploads to MinIO, database records, local OCR processing,
and catalog synchronisation.

The external VLM pipeline (OpenRouter/Qwen-VL) has been replaced with
a local PaddleOCR PP-Structure engine — free, offline, and faster.
All pages of a PDF are now processed (previously only the first page).
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import io
import uuid
from typing import Any, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.modules.documents.json_repair import repair_json
from app.modules.documents.models import (
    Document,
    DocumentStatus,
    DocumentType,
)
from app.modules.documents.schemas import (
    DocumentResponse,
    DocumentListResponse,
    DocumentStatusResponse,
    ItemsUpdateResponse,
)
from app.modules.documents.ocr_client import extract_table_local
from app.modules.catalog.service import sync_document_products
from app.shared.exceptions import NotFoundException, DocumentProcessingError
from app.shared.logging import get_logger
from app.shared.storage import storage_client

logger = get_logger(__name__)


# ═══════════════════════════════════════════════════════════
# Upload
# ═══════════════════════════════════════════════════════════

async def upload_document(
    db: AsyncSession,
    rfq_id: str,
    uploaded_by_id: str,
    file_name: str,
    file_bytes: bytes,
    content_type: Optional[str] = None,
) -> Document:
    """Upload a document to MinIO and create a database record.

    Args:
        db: Database session.
        rfq_id: RFQ UUID string.
        uploaded_by_id: Uploader UUID string.
        file_name: Original file name.
        file_bytes: Raw file bytes.
        content_type: MIME type.

    Returns:
        Created Document instance.

    Raises:
        DocumentProcessingError: If upload to MinIO fails.
    """
    # Determine document type from content type
    doc_type = _infer_document_type(content_type or "", file_name)

    # Generate object key for MinIO
    object_key = f"{rfq_id}/{uuid.uuid4()}/{file_name}"

    # Upload to MinIO
    try:
        await storage_client.upload_file(
            file_bytes=file_bytes,
            key=object_key,
            content_type=content_type or "application/octet-stream",
            bucket=settings.STORAGE_BUCKET_DOCUMENTS,
        )
    except Exception as exc:
        logger.error("Failed to upload document to MinIO", extra={"error": str(exc)})
        raise DocumentProcessingError(
            message="Failed to upload document to storage",
            details={"file_name": file_name, "error": str(exc)},
        )

    # Create DB record
    document = Document(
        rfq_id=uuid.UUID(rfq_id),
        uploaded_by_id=uuid.UUID(uploaded_by_id),
        file_name=file_name,
        file_path=object_key,
        file_size_bytes=len(file_bytes),
        content_type=content_type,
        doc_type=doc_type,
        status=DocumentStatus.UPLOADED,
    )
    db.add(document)
    await db.flush()
    await db.refresh(document)
    return document


async def get_document(db: AsyncSession, document_id: str) -> Document:
    """Get a document by ID.

    Args:
        db: Database session.
        document_id: Document UUID string.

    Returns:
        Document instance.

    Raises:
        NotFoundException: If document not found.
    """
    result = await db.execute(
        select(Document).where(Document.id == uuid.UUID(document_id))
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundException(
            resource="Document",
            resource_id=document_id,
        )
    return doc


async def list_documents(
    db: AsyncSession,
    rfq_id: str,
) -> DocumentListResponse:
    """List all documents for an RFQ.

    Args:
        db: Database session.
        rfq_id: RFQ UUID string.

    Returns:
        Paginated document list response.
    """
    query = (
        select(Document)
        .where(Document.rfq_id == uuid.UUID(rfq_id))
        .order_by(Document.created_at.desc())
    )
    result = await db.execute(query)
    docs = list(result.scalars().all())

    return DocumentListResponse(
        items=[DocumentResponse.model_validate(d) for d in docs],
        total=len(docs),
    )


async def delete_document(
    db: AsyncSession,
    document_id: str,
) -> None:
    """Delete a document record and its storage object.

    Args:
        db: Database session.
        document_id: Document UUID string.

    Raises:
        NotFoundException: If document not found.
    """
    doc = await get_document(db, document_id)

    # Delete from MinIO
    try:
        await storage_client.delete_file(
            key=doc.file_path,
            bucket=settings.STORAGE_BUCKET_DOCUMENTS,
        )
    except Exception as exc:
        logger.warning(
            "Failed to delete file from MinIO (may already be deleted)",
            extra={"file_path": doc.file_path, "error": str(exc)},
        )

    # Delete from DB
    await db.delete(doc)
    await db.flush()


# ═══════════════════════════════════════════════════════════
# OCR / Vision Processing
# ═══════════════════════════════════════════════════════════

async def process_document_vision(
    db: AsyncSession,
    document_id: str,
    provider: Optional[str] = None,
) -> dict:
    """Run local OCR extraction on a document using PaddleOCR PP-Structure.

    Downloads the file from MinIO and runs local PaddleOCR PP-Structure
    to extract product table data. Processes ALL pages of PDFs
    (the old VLM pipeline only processed the first page).

    The ``provider`` parameter is accepted for backward compatibility
    with existing API callers but is **ignored** — extraction is always
    local.

    Args:
        db: Database session.
        document_id: Document UUID string.
        provider: Deprecated — ignored (local OCR always used).

    Returns:
        Extracted entities dict with ``{"products": [...]}``.

    Raises:
        DocumentProcessingError: If processing fails.
    """
    doc = await get_document(db, document_id)

    # Update status to processing
    doc.status = DocumentStatus.PROCESSING
    await db.flush()

    try:
        # Download file from MinIO
        file_bytes = await storage_client.download_file(
            key=doc.file_path,
            bucket=settings.STORAGE_BUCKET_DOCUMENTS,
        )

        # ── Run local PaddleOCR PP-Structure extraction ────────
        # Handles both PDFs (all pages) and images internally
        result_list = await extract_table_local(
            file_bytes=file_bytes,
            file_name=doc.file_name,
        )

        # ── Build the standard entities structure ──────────────
        result: dict = {"products": result_list}

        # Update document with extracted data
        doc.extracted_entities = result
        doc.extracted_text = str(result_list) if result_list else None
        doc.status = DocumentStatus.EXTRACTED
        await db.flush()
        await db.refresh(doc)

        # Sync extracted products into catalog_products table (B-Tree + GIN indexed)
        if result_list:
            await sync_document_products(db, doc)
        else:
            logger.info(
                "No products extracted from document %s — skipping catalog sync",
                document_id,
            )

        return result

    except Exception as exc:
        doc.status = DocumentStatus.FAILED
        doc.error_message = str(exc)
        await db.flush()
        logger.error("Document OCR processing failed", extra={
            "document_id": document_id,
            "error": str(exc),
        })
        raise DocumentProcessingError(
            message="Document OCR processing failed",
            details={"document_id": document_id, "error": str(exc)},
        )


# ═══════════════════════════════════════════════════════════
# Status & Items
# ═══════════════════════════════════════════════════════════


async def get_document_status(
    db: AsyncSession,
    document_id: str,
) -> DocumentStatusResponse:
    """Get lightweight document status for polling.

    Args:
        db: Database session.
        document_id: Document UUID string.

    Returns:
        Status response with current status and extraction data.

    Raises:
        NotFoundException: If document not found.
    """
    doc = await get_document(db, document_id)
    return DocumentStatusResponse.model_validate(doc)


async def update_document_items(
    db: AsyncSession,
    document_id: str,
    items: list[dict[str, Any]],
) -> ItemsUpdateResponse:
    """Manually override the extracted items for a document.

    Used for Human-in-the-Loop corrections after failed or
    partially-successful vision extraction.

    Args:
        db: Database session.
        document_id: Document UUID string.
        items: Replacement list of product item dicts.

    Returns:
        Update response with new extracted_entities.

    Raises:
        NotFoundException: If document not found.
    """
    doc = await get_document(db, document_id)
    doc.extracted_entities = {"products": items}
    doc.status = DocumentStatus.EXTRACTED
    doc.error_message = None  # Clear any previous error
    await db.flush()
    await db.refresh(doc)
    return ItemsUpdateResponse(
        id=str(doc.id),
        status=doc.status.value,
        extracted_entities=doc.extracted_entities,
        updated_at=doc.updated_at,
    )


async def get_document_items(
    db: AsyncSession,
    document_id: str,
) -> list[dict[str, Any]]:
    """Get the extracted product items for a document.

    Args:
        db: Database session.
        document_id: Document UUID string.

    Returns:
        List of extracted product item dicts, or empty list.

    Raises:
        NotFoundException: If document not found.
    """
    doc = await get_document(db, document_id)
    if not doc.extracted_entities:
        return []
    return doc.extracted_entities.get("products", [])


# ═══════════════════════════════════════════════════════════
# Internal Helpers
# ═══════════════════════════════════════════════════════════

def _infer_document_type(content_type: str, file_name: str) -> DocumentType:
    """Infer document type from MIME type and file extension."""
    name_lower = file_name.lower()

    if content_type.startswith("image/"):
        return DocumentType.IMAGE
    if content_type == "application/pdf" or name_lower.endswith(".pdf"):
        return DocumentType.PDF
    if (
        "spreadsheet" in content_type
        or name_lower.endswith((".xls", ".xlsx", ".csv"))
    ):
        return DocumentType.EXCEL

    return DocumentType.OTHER

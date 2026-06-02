"""
AI-Sourcing Hub — Document Service Layer

Handles file uploads to MinIO, database records, OCR/vision processing,
and PDF-to-image conversion for the VLM pipeline.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import io
import uuid
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.modules.documents.json_repair import repair_json
from app.modules.documents.models import (
    Document,
    DocumentStatus,
    DocumentType,
)
from app.modules.documents.schemas import DocumentResponse, DocumentListResponse
from app.modules.documents.vision_client import extract_from_image
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
            message="Document not found",
            details={"document_id": document_id},
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
    """Run vision extraction on a document.

    Downloads the file from MinIO, converts to image if needed,
    sends to VLM, and stores extracted data back in the DB.

    Args:
        db: Database session.
        document_id: Document UUID string.
        provider: Optional vision provider override.

    Returns:
        Extracted entities dict.

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

        # Determine media type
        media_type = _map_to_media_type(doc.content_type or "", doc.file_name)

        # For PDFs, we need to convert first page to image
        if doc.doc_type == DocumentType.PDF:
            image_bytes = await _pdf_page_to_image(file_bytes)
            media_type = "image/png"
        else:
            image_bytes = file_bytes

        # Call VLM
        result = await extract_from_image(
            image_bytes=image_bytes,
            media_type=media_type,
            provider=provider,
        )

        # Try to repair if VLM returned malformed JSON
        if isinstance(result, str):
            repaired = repair_json(result)
            if repaired:
                result = repaired
            else:
                raise DocumentProcessingError(
                    message="Failed to parse VLM response as JSON",
                    details={"document_id": document_id},
                )

        # Update document with extracted data
        doc.extracted_entities = result
        doc.extracted_text = str(result.get("products", result))
        doc.status = DocumentStatus.EXTRACTED
        await db.flush()
        await db.refresh(doc)

        return result

    except Exception as exc:
        doc.status = DocumentStatus.FAILED
        doc.error_message = str(exc)
        await db.flush()
        logger.error("Document vision processing failed", extra={
            "document_id": document_id,
            "error": str(exc),
        })
        raise DocumentProcessingError(
            message="Document vision processing failed",
            details={"document_id": document_id, "error": str(exc)},
        )


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


def _map_to_media_type(content_type: str, file_name: str) -> str:
    """Map content type to media type for VLM."""
    if content_type and content_type.startswith("image/"):
        return content_type
    # Fallback based on extension
    name_lower = file_name.lower()
    if name_lower.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if name_lower.endswith(".png"):
        return "image/png"
    if name_lower.endswith(".webp"):
        return "image/webp"
    return "image/png"  # default fallback


async def _pdf_page_to_image(pdf_bytes: bytes, page_num: int = 0) -> bytes:
    """Convert a PDF page to a PNG image using pdf2image.

    Args:
        pdf_bytes: Raw PDF file bytes.
        page_num: Page number to convert (0-indexed).

    Returns:
        PNG image bytes.

    Raises:
        DocumentProcessingError: If conversion fails.
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
            raise DocumentProcessingError(
                message="PDF page conversion returned no images",
            )
        buf = io.BytesIO()
        images[0].save(buf, format="PNG")
        return buf.getvalue()
    except ImportError:
        raise DocumentProcessingError(
            message="pdf2image is not installed. Install it for PDF processing.",
        )
    except Exception as exc:
        raise DocumentProcessingError(
            message=f"Failed to convert PDF to image: {exc}",
        )

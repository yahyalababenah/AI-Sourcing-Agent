"""
AI-Sourcing Hub — Document Management Endpoints

/api/v1/documents/upload           POST   Upload document to RFQ
/api/v1/documents/{id}             GET    Get document details
/api/v1/documents/{id}             DELETE Delete document
/api/v1/documents/rfq/{rfq_id}     GET    List documents for RFQ
/api/v1/documents/{id}/process     POST   Trigger vision processing
/api/v1/documents/{id}/status      GET    Poll processing status
/api/v1/documents/{id}/items       PUT    Override extracted items
/api/v1/documents/{id}/items       GET    List extracted items
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

# ── File type whitelist ──────────────────────────────────
_ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/vnd.ms-excel",                                                 # .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",        # .xlsx
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "text/csv",
    "text/tab-separated-values",
    "text/plain",
}

# Extensions accepted even when the browser sends a generic/empty Content-Type.
# CSV/TSV/TXT in particular are frequently uploaded as octet-stream or "".
_ALLOWED_EXTENSIONS = {
    ".pdf", ".jpg", ".jpeg", ".png", ".gif",
    ".xls", ".xlsx", ".docx", ".csv", ".tsv", ".txt",
}

# Text formats have no reliable magic signature — content sniffing is skipped.
_SIGNATURELESS_EXTENSIONS = {".csv", ".tsv", ".txt"}
_SIGNATURELESS_TYPES = {"text/csv", "text/tab-separated-values", "text/plain"}

# Magic bytes → the SET of MIME types that share that signature.
# OOXML .xlsx and .docx are both ZIP archives (PK\x03\x04), so one signature
# maps to a group; legacy .xls is an OLE compound file.
_MAGIC_SIGNATURES: list[tuple[bytes, set[str]]] = [
    (b"%PDF", {"application/pdf"}),
    (b"\xff\xd8\xff", {"image/jpeg"}),
    (b"\x89PNG", {"image/png"}),
    (b"GIF8", {"image/gif"}),
    (b"\xd0\xcf\x11\xe0", {"application/vnd.ms-excel"}),
    (
        b"PK\x03\x04",
        {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
    ),
]


def _detect_mime_group(data: bytes) -> Optional[set[str]]:
    for magic, mimes in _MAGIC_SIGNATURES:
        if data[: len(magic)] == magic:
            return mimes
    return None


def _file_ext(filename: Optional[str]) -> str:
    if not filename or "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[1].lower()


def _validate_upload(file: UploadFile, file_bytes: bytes) -> None:
    """Raise HTTPException if file type is not allowed or content doesn't match header."""
    ext = _file_ext(file.filename)
    accepted = "PDF, JPEG, PNG, GIF, XLS, XLSX, DOCX, CSV, TSV, TXT."

    # Accept by declared MIME OR by a known extension (browsers send unreliable
    # MIME for CSV/TSV/TXT — often application/octet-stream or empty).
    if file.content_type not in _ALLOWED_MIME_TYPES and ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file.content_type}' not allowed. Accepted: {accepted}",
        )

    # Text formats have no magic signature — extension/MIME acceptance is enough.
    if file.content_type in _SIGNATURELESS_TYPES or ext in _SIGNATURELESS_EXTENSIONS:
        return

    detected = _detect_mime_group(file_bytes)
    if detected is None:
        raise HTTPException(
            status_code=400,
            detail="Cannot verify file type from content. Upload rejected.",
        )
    # If the caller declared a whitelisted MIME, it must be a member of the
    # signature's group (xlsx/docx share the ZIP signature). When the declared
    # type is generic/unknown, the matched signature alone is sufficient.
    if file.content_type in _ALLOWED_MIME_TYPES and file.content_type not in detected:
        raise HTTPException(
            status_code=400,
            detail="File content does not match declared Content-Type. Upload rejected.",
        )

from app.modules.auth.dependencies import get_current_user, require_agent_or_admin
from app.modules.auth.models import User, UserRole
from app.modules.documents.models import DocumentStatus
from app.shared.exceptions import AuthorizationError
from app.modules.documents.schemas import (
    DocumentListResponse,
    DocumentResponse,
    DocumentStatusResponse,
    DocumentUploadResponse,
    ItemsUpdateRequest,
    ItemsUpdateResponse,
)
from app.modules.documents.service import (
    delete_document,
    get_document,
    get_document_items,
    get_document_status,
    list_documents,
    update_document_items,
    upload_document,
)
from app.modules.documents.tasks import process_document_vision as _ocr_celery_task
from app.modules.intake.service import get_rfq
from app.shared.database import get_db
from app.shared.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=201,
    summary="Upload document to RFQ",
)
async def upload(
    rfq_id: str = Form(..., description="RFQ UUID to attach document to"),
    file: UploadFile = File(..., description="Document file (PDF, image, etc.)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_agent_or_admin),
):
    """Upload a document and associate it with an RFQ.

    Restricted to agents and admins — clients cannot upload documents.
    Verifies the user has access to the target RFQ.
    """
    # Verify user has access to this RFQ
    await get_rfq(
        db,
        rfq_id,
        current_user_id=str(current_user.id),
        current_user_role=str(current_user.role.value),
    )
    file_bytes = await file.read()
    _validate_upload(file, file_bytes)
    doc = await upload_document(
        db,
        rfq_id=rfq_id,
        uploaded_by_id=str(current_user.id),
        file_name=file.filename or "unnamed",
        file_bytes=file_bytes,
        content_type=file.content_type,
    )
    # Trigger OCR asynchronously via Celery (non-blocking).
    # TEMPORARY: sync fallback for demo — Celery workers aren't reliably
    # available in the current hosting environment (e.g. HF Spaces has no
    # worker process), so a broker connection error here must not fail the
    # upload itself. Mark the document FAILED and let the client retry via
    # POST /{id}/process instead of surfacing a 500 for an upload that
    # actually succeeded.
    try:
        _ocr_celery_task.delay(str(doc.id))
    except Exception as exc:
        logger.error(
            "Failed to dispatch OCR task for document %s: %s", doc.id, exc
        )
        doc.status = DocumentStatus.FAILED
        doc.error_message = "OCR dispatch failed. Retry via POST /{id}/process."
        await db.flush()
        await db.refresh(doc)
    return DocumentUploadResponse.model_validate(doc)


@router.get(
    "/rfq/{rfq_id}",
    response_model=DocumentListResponse,
    summary="List documents for an RFQ",
)
async def list_docs(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all documents attached to a specific RFQ.

    Enforces data isolation: verifies the user has access to the parent RFQ.
    """
    # Verify user has access to this RFQ
    await get_rfq(
        db,
        rfq_id,
        current_user_id=str(current_user.id),
        current_user_role=str(current_user.role.value),
    )
    return await list_documents(db, rfq_id)


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
    summary="Get document details",
)
async def get_doc(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed information about a document.

    Enforces data isolation: verifies the user has access to the
    parent RFQ before returning document details.
    """
    doc = await get_document(db, document_id)
    # Verify user has access to the parent RFQ
    await get_rfq(
        db,
        str(doc.rfq_id),
        current_user_id=str(current_user.id),
        current_user_role=str(current_user.role.value),
    )
    return DocumentResponse.model_validate(doc)


@router.delete(
    "/{document_id}",
    status_code=204,
    summary="Delete document",
)
async def delete_doc(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_agent_or_admin),
):
    """Delete a document from storage and database.

    Agents can only delete documents they uploaded.
    Admins can delete any document.
    """
    doc = await get_document(db, document_id)
    if current_user.role != UserRole.ADMIN and str(doc.uploaded_by_id) != str(current_user.id):
        raise AuthorizationError(message="You can only delete documents you uploaded")
    await delete_document(db, document_id)


@router.post(
    "/{document_id}/process",
    summary="Trigger vision processing on document",
)
async def process_doc(
    document_id: str,
    provider: Optional[str] = None,
    _current_user: User = Depends(require_agent_or_admin),
):
    """Re-trigger OCR extraction on a document via Celery (background task).

    Args:
        document_id: Document UUID.
        provider: Deprecated — ignored (local OCR always used).
    """
    try:
        _ocr_celery_task.delay(document_id)
    except Exception as exc:
        logger.error(
            "Failed to dispatch OCR task for document %s: %s", document_id, exc
        )
        raise HTTPException(
            status_code=503,
            detail="OCR task queue is currently unavailable. Please try again later.",
        )
    return {
        "document_id": document_id,
        "status": "queued",
        "message": "OCR task queued — poll /status to track progress",
    }


# ═══════════════════════════════════════════════════════════
# Status Polling
# ═══════════════════════════════════════════════════════════


@router.get(
    "/{document_id}/status",
    response_model=DocumentStatusResponse,
    summary="Poll document processing status",
)
async def get_doc_status(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get lightweight document status for polling.

    Enforces data isolation: verifies the user has access to the
    parent RFQ before returning status.

    Clients should poll this endpoint every 2-3 seconds after
    triggering ``POST /{id}/process`` to check for completion.

    Status transitions:
        - ``uploaded`` → ``processing`` → ``extracted`` (success)
        - ``uploaded`` → ``processing`` → ``failed`` (error)
    """
    doc = await get_document(db, document_id)
    # Verify user has access to the parent RFQ
    await get_rfq(
        db,
        str(doc.rfq_id),
        current_user_id=str(current_user.id),
        current_user_role=str(current_user.role.value),
    )
    return await get_document_status(db, document_id)


# ═══════════════════════════════════════════════════════════
# Extracted Items (Human-in-the-Loop)
# ═══════════════════════════════════════════════════════════


@router.get(
    "/{document_id}/items",
    summary="List extracted product items",
)
async def get_items(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the extracted product items from a processed document.

    Enforces data isolation: verifies the user has access to the
    parent RFQ before returning items.

    Returns an empty list if the document hasn't been processed yet
    or no items were extracted.
    """
    doc = await get_document(db, document_id)
    # Verify user has access to the parent RFQ
    await get_rfq(
        db,
        str(doc.rfq_id),
        current_user_id=str(current_user.id),
        current_user_role=str(current_user.role.value),
    )
    items = await get_document_items(db, document_id)
    return {"items": items, "total": len(items)}


@router.put(
    "/{document_id}/items",
    response_model=ItemsUpdateResponse,
    summary="Override extracted items",
)
async def update_items(
    document_id: str,
    body: ItemsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_agent_or_admin),
):
    """Manually override extracted product items.

    Used for Human-in-the-Loop corrections. Replaces the
    ``extracted_entities`` with the submitted items and resets
    the document status to ``extracted``.
    """
    return await update_document_items(
        db,
        document_id,
        items=[item.model_dump(exclude_none=True) for item in body.items],
    )

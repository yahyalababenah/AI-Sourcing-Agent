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

from app.modules.auth.dependencies import get_current_user, require_agent_or_admin
from app.modules.auth.models import User
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
    process_document_vision,
    update_document_items,
    upload_document,
)
from app.modules.intake.service import get_rfq
from app.shared.database import get_db

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
    doc = await upload_document(
        db,
        rfq_id=rfq_id,
        uploaded_by_id=str(current_user.id),
        file_name=file.filename or "unnamed",
        file_bytes=file_bytes,
        content_type=file.content_type,
    )
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
    _current_user: User = Depends(require_agent_or_admin),
):
    """Delete a document from storage and database."""
    await delete_document(db, document_id)


@router.post(
    "/{document_id}/process",
    summary="Trigger vision processing on document",
)
async def process_doc(
    document_id: str,
    provider: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_agent_or_admin),
):
    """Run vision extraction on a document to extract product data.

    Args:
        document_id: Document UUID.
        provider: Optional vision provider ('together' | 'openrouter').
    """
    result = await process_document_vision(db, document_id, provider=provider)
    return {
        "document_id": document_id,
        "status": "processed",
        "extracted_entities": result,
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

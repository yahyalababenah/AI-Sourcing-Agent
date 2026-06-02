"""
AI-Sourcing Hub — Document Management Endpoints

/api/v1/documents/upload           POST   Upload document to RFQ
/api/v1/documents/{id}             GET    Get document details
/api/v1/documents/{id}             DELETE Delete document
/api/v1/documents/rfq/{rfq_id}     GET    List documents for RFQ
/api/v1/documents/{id}/process     POST   Trigger vision processing
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.dependencies import get_current_user, require_agent_or_admin
from app.modules.auth.models import User
from app.modules.documents.schemas import (
    DocumentListResponse,
    DocumentResponse,
    DocumentUploadResponse,
)
from app.modules.documents.service import (
    delete_document,
    get_document,
    list_documents,
    process_document_vision,
    upload_document,
)
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
    current_user: User = Depends(require_agent_or_admin),
):
    """Upload a document and associate it with an RFQ."""
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
    _current_user: User = Depends(get_current_user),
):
    """Get all documents attached to a specific RFQ."""
    return await list_documents(db, rfq_id)


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
    summary="Get document details",
)
async def get_doc(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Get detailed information about a document."""
    doc = await get_document(db, document_id)
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

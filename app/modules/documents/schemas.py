"""Documents module request/response Pydantic schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DocumentUploadResponse(BaseModel):
    """Response after uploading a document."""

    id: str
    file_name: str
    content_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    """Full document detail response."""

    id: str
    rfq_id: str
    uploaded_by_id: str
    file_name: str
    file_path: str
    file_size_bytes: Optional[int] = None
    content_type: Optional[str] = None
    doc_type: str
    status: str
    extracted_text: Optional[str] = None
    extracted_entities: Optional[dict] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    """Paginated document list."""

    items: list[DocumentResponse]
    total: int

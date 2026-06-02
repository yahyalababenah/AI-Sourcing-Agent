"""Documents module request/response Pydantic schemas."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════
# Upload / Core
# ═══════════════════════════════════════════════════════════


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


# ═══════════════════════════════════════════════════════════
# Status Polling
# ═══════════════════════════════════════════════════════════


class DocumentStatusResponse(BaseModel):
    """Lightweight status response for polling endpoint."""

    id: str
    status: str
    extracted_entities: Optional[dict] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════
# Extracted Items
# ═══════════════════════════════════════════════════════════


class ProductItem(BaseModel):
    """A single product row extracted from a Chinese factory table."""

    product_name: Optional[str] = None
    model_number: Optional[str] = None
    unit_price_rmb: Optional[float] = None
    moq: Optional[int] = None
    weight_kg: Optional[float] = None
    dimensions: Optional[str] = None
    material: Optional[str] = None


class ItemsUpdateRequest(BaseModel):
    """Manual override of extracted items."""

    items: list[ProductItem] = Field(
        ..., description="Replacement list of extracted product items"
    )


class ItemsUpdateResponse(BaseModel):
    """Response after updating document items."""

    id: str
    status: str
    extracted_entities: Optional[dict] = None
    updated_at: datetime

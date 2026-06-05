"""Intake module request/response Pydantic schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class TranslateRequest(BaseModel):
    """Arabic text translation request."""

    raw_text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        examples=["عاوز 500 كرتونة صابون زيت زيتون حلب بوزن 200 جرام"],
    )


class TranslateResponse(BaseModel):
    """Translation result with extracted entities."""

    request_id: str
    chinese_query: str
    entities: dict
    confidence: float = Field(ge=0.0, le=1.0)


class RFQCreate(BaseModel):
    """RFQ creation request (after translation) — used by agents and admins."""

    client_name: Optional[str] = Field(None, max_length=255)
    client_phone: Optional[str] = Field(None, max_length=50)
    client_request_arabic: Optional[str] = None
    translated_query_chinese: Optional[str] = None
    extracted_entities: Optional[dict] = None
    destination_port: Optional[str] = Field(None, max_length=100)
    target_currency: Optional[str] = Field(default="JOD", max_length=10)


class ClientRFQCreate(BaseModel):
    """Restricted RFQ creation schema for clients — no agent/translation fields."""

    client_name: Optional[str] = Field(None, max_length=255)
    client_phone: Optional[str] = Field(None, max_length=50)
    client_request_arabic: Optional[str] = None
    destination_port: Optional[str] = Field(None, max_length=100)
    target_currency: Optional[str] = Field(default="JOD", max_length=10)


class RFQResponse(BaseModel):
    """RFQ detail response."""

    id: UUID
    agent_id: Optional[UUID] = None
    client_id: Optional[UUID] = None
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    client_request_arabic: Optional[str] = None
    translated_query_chinese: Optional[str] = None
    status: str
    extracted_entities: Optional[dict] = None
    destination_port: Optional[str] = None
    target_currency: Optional[str] = None

    # ── Matching fields ──
    matched_supplier_ids: Optional[list[str]] = None
    exclusive_deadline: Optional[datetime] = None
    is_public: bool = False

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RFQListResponse(BaseModel):
    """Paginated RFQ list response."""

    items: list[RFQResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ═══════════════════════════════════════════════════════════
# Product Schema
# ═══════════════════════════════════════════════════════════


class ProductResponse(BaseModel):
    """Product detail response."""

    id: UUID
    rfq_id: UUID
    name: str
    quantity: int
    specifications: Optional[str] = None
    target_price: Optional[float] = None
    extracted_metadata: Optional[dict] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════
# Batch request schemas (eliminate N+1 queries)
# ═══════════════════════════════════════════════════════════


class RFQBatchRequest(BaseModel):
    """Batch fetch RFQs by IDs."""

    ids: list[UUID] = Field(..., min_length=1, max_length=100)


class RFQBatchResponse(BaseModel):
    """Batch RFQ response keyed by RFQ ID."""

    items: dict[str, RFQResponse]


class ProductsBatchRequest(BaseModel):
    """Batch fetch products for multiple RFQs."""

    rfq_ids: list[UUID] = Field(..., min_length=1, max_length=100)


class ProductsBatchResponse(BaseModel):
    """Batch products response keyed by RFQ ID."""

    items: dict[str, list[ProductResponse]]


# ═══════════════════════════════════════════════════════════
# RFQMatch Schemas
# ═══════════════════════════════════════════════════════════


class RFQMatchResponse(BaseModel):
    """RFQ match detail response."""

    id: UUID
    rfq_id: UUID
    supplier_id: UUID
    match_score: float = 0.0
    match_reason: Optional[str] = None
    response_deadline: Optional[datetime] = None
    responded_at: Optional[datetime] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RFQMatchListResponse(BaseModel):
    """Paginated RFQ match list response."""

    items: list[RFQMatchResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ClaimMatchRequest(BaseModel):
    """Request body for claiming/responding to a matched RFQ."""

    action: str = Field(
        ...,
        pattern="^(respond|decline)$",
        description="'respond' to submit a quote, 'decline' to reject the exclusive match",
    )

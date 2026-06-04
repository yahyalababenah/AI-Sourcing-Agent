"""Output (Quotation) module request/response Pydantic schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class QuotationLineItemSchema(BaseModel):
    """A single line item in a quotation."""

    product_id: str
    product_name: str
    quantity: int
    unit_price_cny: float
    unit_price_converted: float
    exchange_rate: float
    freight_cost: float
    customs_duty: float
    commission: float
    subtotal: float
    discount: float
    total: float


class QuotationLineItemResponse(BaseModel):
    """Quotation line item response."""

    id: UUID
    quotation_id: UUID
    product_id: UUID
    product_name: str
    quantity: int
    unit_price_cny: float
    unit_price_converted: float
    exchange_rate_used: float
    freight_cost: float
    customs_duty: float
    commission: float
    subtotal: float
    discount: float
    total: float

    model_config = {"from_attributes": True}


class QuotationCreate(BaseModel):
    """Create a quotation from calculated prices."""

    rfq_id: str
    target_currency: str = Field(default="JOD", max_length=10)
    exchange_rate_used: float
    line_items: list[QuotationLineItemSchema]
    subtotal: float = Field(ge=0)
    freight_total: Optional[float] = 0.0
    customs_total: Optional[float] = 0.0
    commission_total: Optional[float] = 0.0
    discount_total: Optional[float] = 0.0
    vat_total: Optional[float] = 0.0
    grand_total: float = Field(ge=0)
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    validity_days: int = Field(default=30, ge=1, le=365)
    notes: Optional[str] = None


class QuotationResponse(BaseModel):
    """Quotation detail response."""

    id: UUID
    rfq_id: UUID
    agent_id: UUID
    quotation_number: str
    status: str
    tracking_status: Optional[str] = None
    target_currency: str
    exchange_rate_used: float
    subtotal: float
    freight_total: Optional[float] = None
    customs_total: Optional[float] = None
    commission_total: Optional[float] = None
    discount_total: Optional[float] = None
    vat_total: Optional[float] = None
    grand_total: float
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    validity_days: Optional[int] = None
    notes: Optional[str] = None
    pdf_path: Optional[str] = None
    pdf_generated_at: Optional[datetime] = None
    line_items: list[QuotationLineItemResponse] = []
    client_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class QuotationListResponse(BaseModel):
    """Paginated quotation list."""

    items: list[QuotationResponse]
    total: int


# ═══════════════════════════════════════════════════════════
# Tracking Schemas
# ═══════════════════════════════════════════════════════════


class TrackingEventResponse(BaseModel):
    """A single tracking status change event."""

    id: UUID
    quotation_id: UUID
    from_status: Optional[str] = None
    to_status: str
    notes: Optional[str] = None
    changed_by_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TrackingStatusResponse(BaseModel):
    """Current tracking status plus full event history."""

    quotation_id: UUID
    quotation_number: str
    current_status: Optional[str] = None
    events: list[TrackingEventResponse] = []


class UpdateTrackingRequest(BaseModel):
    """Request body for updating tracking status."""

    status: str = Field(
        ...,
        description="New tracking status. Must follow the pipeline order.",
    )
    notes: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional note explaining the status change.",
    )


class QuotationGeneratePdfResponse(BaseModel):
    """Response after PDF generation."""

    quotation_id: str
    pdf_path: str
    pdf_url: str


class QuotationGenerateRequest(BaseModel):
    """Request to generate a quotation asynchronously.

    Accepts pricing data and creates a Quotation record,
    then enqueues a Celery task for background PDF generation.
    """

    rfq_id: str
    target_currency: str = Field(default="JOD", max_length=10)
    exchange_rate_used: float
    line_items: list[QuotationLineItemSchema]
    subtotal: float = Field(ge=0)
    freight_total: Optional[float] = 0.0
    customs_total: Optional[float] = 0.0
    commission_total: Optional[float] = 0.0
    discount_total: Optional[float] = 0.0
    vat_total: Optional[float] = 0.0
    grand_total: float = Field(ge=0)
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    validity_days: int = Field(default=30, ge=1, le=365)
    notes: Optional[str] = None


class QuotationGenerateAcceptedResponse(BaseModel):
    """202 Accepted response after enqueuing PDF generation."""

    quotation_id: str
    status: str = "pending"
    message: str = "Quotation created. PDF generation is in progress."

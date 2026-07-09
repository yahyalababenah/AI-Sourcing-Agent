"""Output (Quotation) module request/response Pydantic schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class QuotationLineItemSchema(BaseModel):
    """A single line item in a quotation."""

    product_id: Optional[str] = None
    catalog_product_id: Optional[str] = None
    product_name: str
    quantity: int
    unit_price_cny: float
    unit_price_converted: float
    exchange_rate: Optional[float] = None
    freight_cost: float = 0.0
    customs_duty: float = 0.0
    commission: float = 0.0
    subtotal: Optional[float] = None
    discount: float = 0.0
    total: float


class QuotationLineItemResponse(BaseModel):
    """Quotation line item response."""

    id: UUID
    quotation_id: UUID
    product_id: Optional[UUID] = None
    catalog_product_id: Optional[UUID] = None
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

    rfq_id: Optional[str] = None
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
    rfq_id: Optional[UUID] = None
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

    rfq_id: Optional[str] = None
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
    """Response after quotation creation + PDF generation.

    TEMPORARY: sync fallback for demo, revert to Celery async once worker
    hosting is resolved. PDF generation now runs inline in the request, so
    `status` is "completed" (PDF ready, see pdf_url) or "pdf_failed" (quotation
    was created but PDF generation raised — quotation_id is still usable).
    """

    quotation_id: str
    status: str = "pending"
    message: str = "Quotation created. PDF generation is in progress."
    pdf_url: Optional[str] = None

"""Pricing module request/response Pydantic schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════
# Pricing Rules
# ═══════════════════════════════════════════════════════════

class PricingRuleCreate(BaseModel):
    """Pricing rule creation request."""

    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    category: str
    rule_type: str = Field(..., pattern="^(percentage|fixed|formula)$")
    value: float
    currency: Optional[str] = Field(None, max_length=10)
    conditions: Optional[dict] = None
    priority: int = Field(default=0, ge=0)
    is_active: bool = True


class PricingRuleResponse(BaseModel):
    """Pricing rule detail response."""

    id: UUID
    name: str
    description: Optional[str] = None
    category: str
    rule_type: str
    value: float
    currency: Optional[str] = None
    conditions: Optional[dict] = None
    priority: int
    is_active: bool
    status: str
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PricingRuleListResponse(BaseModel):
    """List of pricing rules."""

    items: list[PricingRuleResponse]
    total: int


# ═══════════════════════════════════════════════════════════
# Pricing Calculation
# ═══════════════════════════════════════════════════════════

class PriceProductInput(BaseModel):
    """A product requiring price calculation."""

    product_id: str
    name: str
    quantity: int = Field(ge=1)
    unit_price_cny: float = Field(ge=0)


class CalculatePriceRequest(BaseModel):
    """Price calculation request for an RFQ."""

    rfq_id: str
    target_currency: str = Field(default="JOD", max_length=10)
    destination_port: str = Field(..., max_length=100)
    products: list[PriceProductInput]


class LineItemResult(BaseModel):
    """Calculated line item result."""

    product_id: str
    product_name: str
    quantity: int
    unit_price_cny: float
    exchange_rate: float
    unit_price_converted: float
    freight_cost: float
    customs_duty: float
    clearance_fee: float = 0.0
    commission: float
    subtotal: float
    discount: float
    total: float


class CalculatePriceResponse(BaseModel):
    """Full price calculation result."""

    rfq_id: str
    target_currency: str
    exchange_rate_used: float
    line_items: list[LineItemResult]
    subtotal_before_vat: float = 0.0
    vat: float = 0.0
    early_payment_discount: float = 0.0
    grand_total: float
    discount_total: float
    rules_applied: list[str]


# ═══════════════════════════════════════════════════════════
# Quick Estimate (marketplace — no RFQ required)
# ═══════════════════════════════════════════════════════════

class QuickEstimateRequest(BaseModel):
    """Lightweight cost estimate for marketplace browsing."""

    unit_price_cny: float = Field(ge=0)
    quantity: int = Field(default=1, ge=1)
    destination_port: str = Field(default="Aqaba", max_length=100)
    target_currency: str = Field(default="JOD", max_length=10)


class QuickEstimateResponse(BaseModel):
    """Estimated landed cost breakdown (without shipping)."""

    unit_price_cny: float
    quantity: int
    exchange_rate: float
    target_currency: str
    unit_price_converted: float
    customs_duty: float
    clearance_fee: float
    subtotal_excl_shipping: float
    vat: float
    estimated_total: float
    note: str = "الشحن يُحدَّد بعد تأكيد الكمية مع المندوب"

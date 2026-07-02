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
# HS-Code Fee Schedules
# ═══════════════════════════════════════════════════════════

class HSCodeFeeScheduleCreate(BaseModel):
    """HS-Code fee schedule creation/update request."""

    hs_code: str = Field(..., max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    duty_rate_001: float = Field(..., ge=0, description="Duty rate 001, percent on CIF")
    service_flat_fee_301: float = Field(default=0.0, ge=0, description="Flat service fee 301, JOD")
    service_percent_070: float = Field(default=0.0, ge=0, description="Service fee 070, percent on CIF")
    requires_license: bool = False
    penalty_rate_018: float = Field(default=0.0, ge=0, description="Conditional import penalty 018, percent on CIF")
    is_verified: bool = False
    source_note: Optional[str] = None


class HSCodeFeeScheduleResponse(BaseModel):
    """HS-Code fee schedule detail response."""

    id: UUID
    hs_code: str
    description: Optional[str] = None
    duty_rate_001: float
    service_flat_fee_301: float
    service_percent_070: float
    requires_license: bool
    penalty_rate_018: float
    is_verified: bool
    source_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HSCodeFeeScheduleListResponse(BaseModel):
    """List of HS-Code fee schedules."""

    items: list[HSCodeFeeScheduleResponse]
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
    hs_code: Optional[str] = Field(None, max_length=50)
    has_license: bool = Field(
        default=False,
        description="Whether the importer has confirmed the required license/conformity certificate for this product's HS code",
    )
    weight_kg: float = Field(
        default=0.0,
        ge=0,
        description=(
            "Per-unit weight in kilograms, used to estimate shipping volume (CBM). "
            "FIX: previously this field did not exist on the schema, so freight was "
            "always computed off a phantom 0.1 CBM minimum regardless of the actual "
            "product weight. Pass the real weight (e.g. from CatalogProduct.weight_kg) "
            "for an accurate freight estimate."
        ),
    )


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
    insurance_cost: float = 0.0
    cif_value: float = 0.0
    customs_duty: float
    clearance_fee: float = 0.0
    commission: float
    subtotal: float
    discount: float
    total: float
    service_flat_301: float = 0.0
    service_percent_070: float = 0.0
    penalty_018: float = 0.0
    hs_code_matched: bool = False


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
    hs_code: Optional[str] = Field(None, max_length=50)
    has_license: bool = Field(
        default=False,
        description="Whether the importer has confirmed the required license/conformity certificate for this product's HS code",
    )
    weight_kg: float = Field(
        default=0.0,
        ge=0,
        description="Per-unit weight in kg (e.g. from CatalogProduct.weight_kg) for an accurate freight estimate.",
    )


class QuickEstimateResponse(BaseModel):
    """Estimated landed cost breakdown (without shipping)."""

    unit_price_cny: float
    quantity: int
    exchange_rate: float
    target_currency: str
    unit_price_converted: float
    insurance_cost: float = 0.0
    cif_value: float = 0.0
    customs_duty: float
    clearance_fee: float
    subtotal_excl_shipping: float
    vat: float
    estimated_total: float
    service_flat_301: float = 0.0
    service_percent_070: float = 0.0
    penalty_018: float = 0.0
    hs_code_matched: bool = False
    note: str = "الشحن يُحدَّد بعد تأكيد الكمية مع المندوب"

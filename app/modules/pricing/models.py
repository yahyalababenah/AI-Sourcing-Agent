"""
AI-Sourcing Hub — Pricing Rule & Calculation Models

Stores the 16 pricing rules (exchange rates, freight, customs, commission, MOQ, etc.)
and calculated quotation line items.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import enum
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.shared.database import Base


class PricingRuleCategory(str, enum.Enum):
    EXCHANGE_RATE = "exchange_rate"
    FREIGHT = "freight"
    CUSTOMS = "customs"
    CLEARANCE = "clearance"
    COMMISSION = "commission"
    DISCOUNT = "discount"
    MOQ_DISCOUNT = "moq_discount"
    TAX = "tax"
    MARGIN = "margin"
    OTHER = "other"


class PricingRuleStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class PricingRule(Base):
    """A single pricing rule (e.g., exchange rate, freight cost, customs %)."""

    __tablename__ = "pricing_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(
        Enum(PricingRuleCategory, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        index=True,
    )
    rule_type = Column(String(50), nullable=False)  # percentage | fixed | formula
    value = Column(Float, nullable=False)  # The numeric value / rate
    formula = Column(Text, nullable=True)  # Expression used when rule_type == "formula"
    currency = Column(String(10), nullable=True)
    conditions = Column(JSONB, nullable=True)  # e.g., {"min_quantity": 1000, "port": "Aqaba"}
    priority = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    status = Column(
        Enum(PricingRuleStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=PricingRuleStatus.ACTIVE,
        nullable=False,
    )
    version = Column(Integer, default=1, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<PricingRule(id={self.id}, name={self.name}, category={self.category})>"


class HSCodeFeeSchedule(Base):
    """Multi-item customs fee schedule for a specific Harmonized System code.

    Real Jordan Customs (JCAP) tax simulations return multiple separate line
    items per HS code (001 duty, 020 VAT, 301 flat service fee, 070 percent
    service fee, 018 conditional import penalty) rather than a single general
    rate. This table stores the per-HS-code values for those items, verified
    against real JCAP simulation results where available.
    """

    __tablename__ = "hs_code_fee_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hs_code = Column(String(50), nullable=False, unique=True, index=True)
    description = Column(String(500), nullable=True)
    duty_rate_001 = Column(Float, nullable=False)  # % on CIF
    service_flat_fee_301 = Column(Float, nullable=False, default=0.0)  # flat JOD
    service_percent_070 = Column(Float, nullable=False, default=0.0)  # % on CIF
    requires_license = Column(Boolean, nullable=False, default=False)
    penalty_rate_018 = Column(Float, nullable=False, default=0.0)  # % on CIF, conditional
    vat_rate_020 = Column(Float, nullable=True)  # % on (CIF + duty); None = use global default
    is_verified = Column(Boolean, nullable=False, default=False)
    source_note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<HSCodeFeeSchedule(hs_code={self.hs_code}, verified={self.is_verified})>"


class QuotationLineItem(Base):
    """An individual line item within a calculated quotation."""

    __tablename__ = "quotation_line_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_id = Column(
        UUID(as_uuid=True), ForeignKey("quotations.id"), nullable=False, index=True
    )
    product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=True
    )
    catalog_product_id = Column(
        UUID(as_uuid=True), ForeignKey("catalog_products.id"), nullable=True,
        doc="Supplier catalog product this line item was quoted from, if any",
    )
    product_name = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price_cny = Column(Float, nullable=False)  # Price in CNY
    unit_price_converted = Column(Float, nullable=False)  # Converted to target currency
    exchange_rate_used = Column(Float, nullable=False)
    freight_cost = Column(Float, nullable=True, default=0.0)
    customs_duty = Column(Float, nullable=True, default=0.0)
    commission = Column(Float, nullable=True, default=0.0)
    subtotal = Column(Float, nullable=False)
    discount = Column(Float, nullable=True, default=0.0)
    total = Column(Float, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # ---- Relationships ----
    quotation = relationship("app.modules.output.models.Quotation", back_populates="line_items")
    product = relationship("app.modules.intake.models.Product", back_populates="line_items")

    def __repr__(self) -> str:
        return f"<QuotationLineItem(id={self.id}, product={self.product_name})>"

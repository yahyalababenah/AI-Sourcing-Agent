"""
AI-Sourcing Hub — Quotation & Order Tracking Models

Stores finalized quotations with calculated pricing, Jinja2/WeasyPrint PDF output,
and order tracking status for shipments.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.shared.database import Base


class QuotationStatus(str, enum.Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"


class TrackingStatus(str, enum.Enum):
    """Six-stage order tracking pipeline.

    When a quotation is ACCEPTED, it becomes an "order" and progresses
    through these stages:
        AWAITING_PAYMENT → PRODUCTION → INLAND_FREIGHT
        → SEA_FREIGHT → CUSTOMS → DELIVERED
    """

    AWAITING_PAYMENT = "awaiting_payment"
    PRODUCTION = "production"
    INLAND_FREIGHT = "inland_freight"
    SEA_FREIGHT = "sea_freight"
    CUSTOMS = "customs"
    DELIVERED = "delivered"


class Quotation(Base):
    """A finalized quotation generated from an RFQ with calculated pricing."""

    __tablename__ = "quotations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id = Column(
        UUID(as_uuid=True), ForeignKey("rfqs.id"), nullable=True, index=True
    )
    agent_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    quotation_number = Column(
        String(50), unique=True, nullable=False, index=True
    )
    status = Column(
        Enum(QuotationStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=QuotationStatus.DRAFT,
        nullable=False,
        index=True,
    )

    # Order tracking (only meaningful when status == ACCEPTED)
    tracking_status = Column(
        Enum(TrackingStatus, values_callable=lambda obj: [e.value for e in obj]),
        nullable=True,
        index=True,
    )

    # Pricing summary (denormalized from line items)
    target_currency = Column(String(10), nullable=False, default="JOD")
    exchange_rate_used = Column(Float, nullable=False)
    subtotal = Column(Float, nullable=False)
    freight_total = Column(Float, nullable=True, default=0.0)
    customs_total = Column(Float, nullable=True, default=0.0)
    commission_total = Column(Float, nullable=True, default=0.0)
    discount_total = Column(Float, nullable=True, default=0.0)
    vat_total = Column(Float, nullable=True, default=0.0)
    grand_total = Column(Float, nullable=False)

    # Terms
    payment_terms = Column(Text, nullable=True)
    delivery_terms = Column(Text, nullable=True)
    validity_days = Column(
        Integer, default=30, nullable=False
    )
    notes = Column(Text, nullable=True)

    # PDF storage
    pdf_path = Column(String(1000), nullable=True)  # MinIO object key
    pdf_generated_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ---- Relationships ----
    rfq = relationship("app.modules.intake.models.RFQ", back_populates="quotations")
    agent = relationship("app.modules.auth.models.User", back_populates="quotations")
    line_items = relationship(
        "app.modules.pricing.models.QuotationLineItem",
        back_populates="quotation",
        cascade="all, delete-orphan",
    )
    tracking_events = relationship(
        "TrackingEvent",
        back_populates="quotation",
        cascade="all, delete-orphan",
        order_by="TrackingEvent.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<Quotation(id={self.id}, number={self.quotation_number}, status={self.status})>"


class TrackingEvent(Base):
    """Audit log of tracking status changes for an order (accepted quotation).

    Each time ``tracking_status`` changes on a Quotation, a new TrackingEvent
    is recorded to create a full history timeline.
    """

    __tablename__ = "tracking_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("quotations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_status = Column(
        Enum(TrackingStatus, values_callable=lambda obj: [e.value for e in obj]),
        nullable=True,
    )
    to_status = Column(
        Enum(TrackingStatus, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    notes = Column(Text, nullable=True)  # Optional note from agent
    changed_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ---- Relationships ----
    quotation = relationship("Quotation", back_populates="tracking_events")
    changed_by = relationship("app.modules.auth.models.User")

    def __repr__(self) -> str:
        return (
            f"<TrackingEvent(id={self.id}, "
            f"{self.from_status} → {self.to_status})>"
        )

"""
AI-Sourcing Hub — RFQ & Product Models

⚠️ String-based relationships to avoid circular imports with other modules.
"""

import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.shared.database import Base


class RFQStatus(str, enum.Enum):
    OPEN = "open"
    PROCESSING = "processing"
    QUOTED = "quoted"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class ProductStatus(str, enum.Enum):
    PENDING = "pending"
    QUOTED = "quoted"


class RFQ(Base):
    __tablename__ = "rfqs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    client_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    client_name = Column(String(255), nullable=True)
    client_phone = Column(String(50), nullable=True)
    client_request_arabic = Column(Text, nullable=True)
    translated_query_chinese = Column(Text, nullable=True)
    status = Column(
        Enum(RFQStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=RFQStatus.OPEN,
        nullable=False,
        index=True,
    )
    extracted_entities = Column(JSONB, nullable=True)
    destination_port = Column(String(100), nullable=True)
    target_currency = Column(String(10), nullable=True, default="JOD")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ---- Relationships ----
    agent = relationship(
        "app.modules.auth.models.User",
        foreign_keys=[agent_id],
        back_populates="rfqs",
    )
    client = relationship(
        "app.modules.auth.models.User",
        foreign_keys=[client_id],
        back_populates="client_rfqs",
    )
    products = relationship("Product", back_populates="rfq", cascade="all, delete-orphan")
    documents = relationship(
        "app.modules.documents.models.Document", back_populates="rfq"
    )
    quotations = relationship(
        "app.modules.output.models.Quotation", back_populates="rfq"
    )

    def __repr__(self) -> str:
        return f"<RFQ(id={self.id}, status={self.status})>"


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id = Column(
        UUID(as_uuid=True), ForeignKey("rfqs.id"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)
    specifications = Column(Text, nullable=True)
    quantity = Column(Integer, nullable=False)
    target_price = Column(  # nullable; client's budget expectation
        Float(precision=10),
        nullable=True,
    )
    status = Column(
        Enum(ProductStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=ProductStatus.PENDING,
        nullable=False,
    )
    extracted_metadata = Column(JSONB, nullable=True)  # From PDF parsing

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # ---- Relationships ----
    rfq = relationship("RFQ", back_populates="products")
    line_items = relationship(
        "app.modules.pricing.models.QuotationLineItem", back_populates="product"
    )

    def __repr__(self) -> str:
        return f"<Product(id={self.id}, name={self.name})>"

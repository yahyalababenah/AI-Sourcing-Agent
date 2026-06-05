"""
AI-Sourcing Hub — User & Profile Models

⚠️ String-based relationships to avoid circular imports with other modules.
"""

import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.shared.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    AGENT = "agent"
    CLIENT = "client"


class VerificationStatus(str, enum.Enum):
    """Verification status for supplier profiles."""
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, values_callable=lambda obj: [e.value for e in obj]), default=UserRole.AGENT, nullable=False)
    phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    preferences = Column(JSONB, nullable=True, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ---- String-based relationships (cross-module) ----
    # ⚠️ Never import models from other modules at the top level
    # RFQs where this user is the assigned agent (via agent_id FK)
    rfqs = relationship(
        "app.modules.intake.models.RFQ",
        foreign_keys="[RFQ.agent_id]",
        back_populates="agent",
    )
    # RFQs where this user is the owning client (via client_id FK)
    client_rfqs = relationship(
        "app.modules.intake.models.RFQ",
        foreign_keys="[RFQ.client_id]",
        back_populates="client",
    )
    quotations = relationship(
        "app.modules.output.models.Quotation", back_populates="agent"
    )
    documents = relationship(
        "app.modules.documents.models.Document", back_populates="uploaded_by"
    )
    rfq_matches = relationship(
        "app.modules.intake.models.RFQMatch",
        foreign_keys="[RFQMatch.supplier_id]",
        back_populates="supplier",
    )

    # ---- One-to-one profile relationships ----
    client_profile = relationship("ClientProfile", back_populates="user", uselist=False)
    supplier_profile = relationship("SupplierProfile", back_populates="user", uselist=False)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"


class ClientProfile(Base):
    """One-to-one profile for client users (buyers)."""

    __tablename__ = "client_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    company_name = Column(String(255), nullable=False)
    preferred_port = Column(String(100), nullable=True)
    contact_number = Column(String(50), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ---- Relationships ----
    user = relationship("User", back_populates="client_profile")

    def __repr__(self) -> str:
        return f"<ClientProfile(id={self.id}, company={self.company_name})>"


class SupplierProfile(Base):
    """One-to-one profile for agent/supplier users (sellers)."""

    __tablename__ = "supplier_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    factory_name = Column(String(255), nullable=False)
    location_in_china = Column(String(255), nullable=False)
    specialty = Column(String(255), nullable=True)
    business_registration_number = Column(String(100), nullable=True)

    # ── New columns for Leaf 2 (Supplier Profile Expansion) ──
    business_license_url = Column(String(500), nullable=True)
    """MinIO URL pointing to the uploaded business license document."""
    factory_address = Column(Text, nullable=True)
    """Detailed factory street address (may differ from general location_in_china)."""
    verification_status = Column(
        Enum(VerificationStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=VerificationStatus.PENDING,
        server_default=VerificationStatus.PENDING.value,
    )
    """Verification status: pending → verified → rejected."""
    product_categories = Column(JSONB, nullable=True, default=list)
    """List of product categories this supplier specializes in.
    Auto-derived from their uploaded catalog products.
    Used by the matching algorithm to pair RFQs with relevant suppliers."""

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ---- Relationships ----
    user = relationship("User", back_populates="supplier_profile")

    def __repr__(self) -> str:
        return f"<SupplierProfile(id={self.id}, factory={self.factory_name}, status={self.verification_status})>"

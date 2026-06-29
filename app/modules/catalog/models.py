"""
AI-Sourcing Hub — Catalog Product Model

Dedicated table for AI-extracted product listings, enabling proper
database-level indexing, full-text search via GIN/tsvector, and
efficient filtered queries (price range, category, supplier).

Previously, products were stored only as JSONB inside
``Document.extracted_entities['products']`` and filtered in Python
memory, which does not scale. This model is the foundation for
production-grade catalog search.
"""

import uuid

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Index,
    func,
    DDL,
    event,
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID, TSVECTOR
from sqlalchemy.orm import relationship

import enum


class ProductReviewStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

from app.shared.database import Base


class CatalogProduct(Base):
    """A single product listing sourced from a supplier's uploaded document.

    Each row represents one product extracted from a Chinese PDF/catalogue.
    The ``search_vector`` column is auto-maintained by a PostgreSQL trigger
    that concatenates and tokenises ``product_name``, ``model_number``,
    ``material``, and ``category`` for efficient full-text search (GIN index).
    """

    __tablename__ = "catalog_products"

    # ── Primary Key ──
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique product identifier",
    )

    # ── Foreign Keys ──
    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Source document from which this product was extracted",
    )
    supplier_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Supplier (agent) who owns the source document",
    )

    # ── Product Fields ──
    product_name = Column(
        String(500),
        nullable=False,
        doc="Product name in Chinese (extracted from catalogue)",
    )
    model_number = Column(
        String(200),
        nullable=True,
        doc="Model / part number if available",
    )
    unit_price_rmb = Column(
        Float,
        nullable=True,
        doc="Unit price in Chinese Yuan (RMB) — B-Tree indexed for range queries",
    )
    moq = Column(
        Integer,
        nullable=True,
        doc="Minimum order quantity",
    )
    weight_kg = Column(
        Float,
        nullable=True,
        doc="Unit weight in kilograms",
    )
    dimensions = Column(
        String(200),
        nullable=True,
        doc="Product dimensions (e.g. '30×20×15 cm')",
    )
    material = Column(
        String(200),
        nullable=True,
        doc="Primary material (used as category fallback)",
    )
    category = Column(
        String(200),
        nullable=True,
        doc="Product category — B-Tree indexed for filtered queries",
    )

    # ── Review Status ──
    review_status = Column(
        SAEnum(ProductReviewStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ProductReviewStatus.PENDING,
        server_default=ProductReviewStatus.PENDING.value,
        doc="Agent review status: pending → approved/rejected",
    )

    # ── Full-Text Search Vector (GIN-indexed) ──
    search_vector = Column(
        TSVECTOR,
        nullable=True,
        doc="Auto-maintained tsvector for PostgreSQL full-text search (GIN index)",
    )

    # ── Timestamps ──
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        doc="Row creation timestamp",
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        doc="Last update timestamp",
    )

    # ── Relationships ──
    document = relationship("app.modules.documents.models.Document", backref="catalog_products")
    supplier = relationship("app.modules.auth.models.User", backref="catalog_products")

    def __repr__(self) -> str:
        return (
            f"<CatalogProduct(id={self.id}, "
            f"name={self.product_name!r}, "
            f"price={self.unit_price_rmb}, "
            f"supplier={self.supplier_id})>"
        )


# ── Additional Indexes (declared at table level for clarity) ──

# B-Tree on unit_price_rmb — accelerates min_price / max_price range queries
Index("ix_catalog_products_price", CatalogProduct.unit_price_rmb)

# B-Tree on category — accelerates category filter
Index("ix_catalog_products_category", CatalogProduct.category)

# GIN on search_vector — powers full-text search via to_tsquery / plainto_tsquery
Index("ix_catalog_products_search", CatalogProduct.search_vector, postgresql_using="gin")


# ── Trigger: Auto-maintain search_vector ──
# We define a PL/pgSQL trigger function that concatenates searchable fields
# and converts them to a tsvector using the 'simple' configuration (no stemming,
# suitable for mixed-language Chinese/English product names).

_SEARCH_VECTOR_TRIGGER_FUNC = DDL(
    """
    CREATE OR REPLACE FUNCTION catalog_products_search_vector_trigger()
    RETURNS trigger AS $$
    BEGIN
        NEW.search_vector := to_tsvector('simple',
            COALESCE(NEW.product_name, '') || ' ' ||
            COALESCE(NEW.model_number, '') || ' ' ||
            COALESCE(NEW.material, '') || ' ' ||
            COALESCE(NEW.category, '')
        );
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """
)

_SEARCH_VECTOR_TRIGGER = DDL(
    """
    CREATE TRIGGER trg_catalog_products_search_vector
    BEFORE INSERT OR UPDATE OF product_name, model_number, material, category
    ON catalog_products
    FOR EACH ROW
    EXECUTE FUNCTION catalog_products_search_vector_trigger();
    """
)

# Register event listeners to create the trigger function and trigger
# when the table is created (via Alembic migration or metadata.create_all).
event.listen(
    CatalogProduct.__table__,
    "after_create",
    _SEARCH_VECTOR_TRIGGER_FUNC,
)
event.listen(
    CatalogProduct.__table__,
    "after_create",
    _SEARCH_VECTOR_TRIGGER,
)

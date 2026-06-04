"""
AI-Sourcing Hub — Add Catalog Products Table

Creates:
    - catalog_products  (dedicated table for AI-extracted product listings)

Indexes:
    - B-Tree on unit_price_rmb   → accelerates min/max price range queries
    - B-Tree on category          → accelerates category filters
    - B-Tree on supplier_id       → accelerates supplier scoping
    - GIN  on search_vector       → PostgreSQL full-text search

Triggers:
    - Auto-maintain search_vector tsvector from product_name, model_number,
      material, and category fields on INSERT or UPDATE.

Revision ID: 006
Revises: 005
Create Date: 2026-06-04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create catalog_products table with indexes and search trigger."""

    # ── 1. Create the table ──
    op.create_table(
        "catalog_products",
        # Primary Key
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        # Foreign Keys
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "supplier_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Product Fields
        sa.Column("product_name", sa.String(500), nullable=False),
        sa.Column("model_number", sa.String(200), nullable=True),
        sa.Column("unit_price_rmb", sa.Float, nullable=True),
        sa.Column("moq", sa.Integer, nullable=True),
        sa.Column("weight_kg", sa.Float, nullable=True),
        sa.Column("dimensions", sa.String(200), nullable=True),
        sa.Column("material", sa.String(200), nullable=True),
        sa.Column("category", sa.String(200), nullable=True),
        # Full-Text Search Vector
        sa.Column("search_vector", postgresql.TSVECTOR, nullable=True),
        # Timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # ── 2. Create B-Tree Indexes ──
    op.create_index(
        "ix_catalog_products_document",
        "catalog_products",
        ["document_id"],
        postgresql_using="btree",
    )
    op.create_index(
        "ix_catalog_products_supplier",
        "catalog_products",
        ["supplier_id"],
        postgresql_using="btree",
    )
    op.create_index(
        "ix_catalog_products_price",
        "catalog_products",
        ["unit_price_rmb"],
        postgresql_using="btree",
    )
    op.create_index(
        "ix_catalog_products_category",
        "catalog_products",
        ["category"],
        postgresql_using="btree",
    )

    # ── 3. Create GIN Index on search_vector ──
    op.create_index(
        "ix_catalog_products_search",
        "catalog_products",
        ["search_vector"],
        postgresql_using="gin",
    )

    # ── 4. Create trigger function and trigger for auto-maintaining tsvector ──
    op.execute(
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
    op.execute(
        """
        CREATE TRIGGER trg_catalog_products_search_vector
        BEFORE INSERT OR UPDATE OF product_name, model_number, material, category
        ON catalog_products
        FOR EACH ROW
        EXECUTE FUNCTION catalog_products_search_vector_trigger();
        """
    )


def downgrade() -> None:
    """Drop catalog_products table and its triggers/indexes."""

    # Drop trigger first (must be before table drop)
    op.execute(
        "DROP TRIGGER IF EXISTS trg_catalog_products_search_vector ON catalog_products"
    )
    op.execute(
        "DROP FUNCTION IF EXISTS catalog_products_search_vector_trigger()"
    )

    # Drop indexes
    op.drop_index("ix_catalog_products_search", table_name="catalog_products")
    op.drop_index("ix_catalog_products_price", table_name="catalog_products")
    op.drop_index("ix_catalog_products_category", table_name="catalog_products")
    op.drop_index("ix_catalog_products_supplier", table_name="catalog_products")
    op.drop_index("ix_catalog_products_document", table_name="catalog_products")

    # Drop table
    op.drop_table("catalog_products")

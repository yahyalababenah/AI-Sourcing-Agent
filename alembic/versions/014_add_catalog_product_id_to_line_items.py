"""add catalog_product_id to quotation_line_items

Revision ID: 014_catalog_product_line_item
Revises: 013_nullable_product_id
Create Date: 2026-07-01
"""

from alembic import op
import sqlalchemy as sa

revision = "014_catalog_product_line_item"
down_revision = "013_nullable_product_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "quotation_line_items",
        sa.Column(
            "catalog_product_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_quotation_line_items_catalog_product_id",
        "quotation_line_items",
        "catalog_products",
        ["catalog_product_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_quotation_line_items_catalog_product_id",
        "quotation_line_items",
        type_="foreignkey",
    )
    op.drop_column("quotation_line_items", "catalog_product_id")

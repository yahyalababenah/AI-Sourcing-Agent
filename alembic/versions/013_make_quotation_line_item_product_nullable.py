"""make quotation_line_item product_id nullable

Revision ID: 013_nullable_product_id
Revises: 012_catalog_review_status
Create Date: 2026-06-29
"""

from alembic import op
import sqlalchemy as sa

revision = "013_nullable_product_id"
down_revision = "012_catalog_review_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "quotation_line_items",
        "product_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "quotation_line_items",
        "product_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=False,
    )

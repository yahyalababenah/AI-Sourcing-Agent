"""add review_status to catalog_products

Revision ID: 012_catalog_review_status
Revises: 011_add_rfq_exclusive_deadline_index
Create Date: 2026-06-29
"""

from alembic import op
import sqlalchemy as sa

revision = "012_catalog_review_status"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type
    op.execute("CREATE TYPE productreviewstatus AS ENUM ('pending', 'approved', 'rejected')")

    op.add_column(
        "catalog_products",
        sa.Column(
            "review_status",
            sa.Enum("pending", "approved", "rejected", name="productreviewstatus"),
            nullable=False,
            server_default="pending",
        ),
    )

    # Index for fast pending-product queries
    op.create_index(
        "ix_catalog_products_review_status",
        "catalog_products",
        ["review_status"],
    )


def downgrade() -> None:
    op.drop_index("ix_catalog_products_review_status", table_name="catalog_products")
    op.drop_column("catalog_products", "review_status")
    op.execute("DROP TYPE IF EXISTS productreviewstatus")

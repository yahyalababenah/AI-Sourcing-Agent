"""add hs_code_fee_schedules table and hs_code column on catalog_products

Revision ID: 015_hs_code_fee_schedules
Revises: 014_catalog_product_line_item
Create Date: 2026-07-01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "015_hs_code_fee_schedules"
down_revision = "014_catalog_product_line_item"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hs_code_fee_schedules",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("hs_code", sa.String(50), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("duty_rate_001", sa.Float(), nullable=False),
        sa.Column("service_flat_fee_301", sa.Float(), nullable=False, server_default="0"),
        sa.Column("service_percent_070", sa.Float(), nullable=False, server_default="0"),
        sa.Column("requires_license", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("penalty_rate_018", sa.Float(), nullable=False, server_default="0"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("source_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_hs_code_fee_schedules_hs_code",
        "hs_code_fee_schedules",
        ["hs_code"],
        unique=True,
    )

    op.add_column(
        "catalog_products",
        sa.Column("hs_code", sa.String(50), nullable=True),
    )
    op.create_index(
        "ix_catalog_products_hs_code",
        "catalog_products",
        ["hs_code"],
    )


def downgrade() -> None:
    op.drop_index("ix_catalog_products_hs_code", table_name="catalog_products")
    op.drop_column("catalog_products", "hs_code")

    op.drop_index("ix_hs_code_fee_schedules_hs_code", table_name="hs_code_fee_schedules")
    op.drop_table("hs_code_fee_schedules")

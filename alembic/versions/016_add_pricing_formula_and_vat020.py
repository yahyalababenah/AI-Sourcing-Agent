"""add formula column to pricing_rules and vat_rate_020 to hs_code_fee_schedules

Revision ID: 016_pricing_formula_vat020
Revises: 015_hs_code_fee_schedules
Create Date: 2026-07-04
"""

from alembic import op
import sqlalchemy as sa

revision = "016_pricing_formula_vat020"
down_revision = "015_hs_code_fee_schedules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pricing_rules",
        sa.Column("formula", sa.Text(), nullable=True),
    )
    op.add_column(
        "hs_code_fee_schedules",
        sa.Column("vat_rate_020", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("hs_code_fee_schedules", "vat_rate_020")
    op.drop_column("pricing_rules", "formula")

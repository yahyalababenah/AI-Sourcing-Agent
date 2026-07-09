"""add backward-compat fields (duty_rate, vat_rate, service_fee, additional_fee, is_active) to hs_code_fee_schedules

The JCAP-specific fields (duty_rate_001, service_flat_fee_301, etc.) were added
in migration 015. This migration adds the legacy single-rate fields back for
backward compatibility with older code paths, and backfills them from the
corresponding JCAP values where possible.

Revision ID: 017_backward_compat_fields
Revises: 016_pricing_formula_vat020
Create Date: 2026-07-09
"""

from alembic import op
import sqlalchemy as sa

revision = "017_backward_compat_fields"
down_revision = "016_pricing_formula_vat020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Add legacy backward-compat columns ─────────────────────────────────
    op.add_column(
        "hs_code_fee_schedules",
        sa.Column("duty_rate", sa.Float(), nullable=True),
    )
    op.add_column(
        "hs_code_fee_schedules",
        sa.Column("vat_rate", sa.Float(), nullable=True),
    )
    op.add_column(
        "hs_code_fee_schedules",
        sa.Column("service_fee", sa.Float(), nullable=True),
    )
    op.add_column(
        "hs_code_fee_schedules",
        sa.Column("additional_fee", sa.Float(), nullable=True),
    )
    op.add_column(
        "hs_code_fee_schedules",
        sa.Column("is_active", sa.Boolean(), nullable=True),
    )

    # ── Backfill legacy fields from existing JCAP fields ───────────────────
    # duty_rate ← duty_rate_001 (if set)
    op.execute(
        """
        UPDATE hs_code_fee_schedules
        SET duty_rate = duty_rate_001
        WHERE duty_rate_001 IS NOT NULL AND duty_rate_001 > 0
        """
    )
    # vat_rate ← vat_rate_020 (if set)
    op.execute(
        """
        UPDATE hs_code_fee_schedules
        SET vat_rate = vat_rate_020
        WHERE vat_rate_020 IS NOT NULL
        """
    )
    # service_fee ← service_flat_fee_301 (if set)
    op.execute(
        """
        UPDATE hs_code_fee_schedules
        SET service_fee = service_flat_fee_301
        WHERE service_flat_fee_301 IS NOT NULL AND service_flat_fee_301 > 0
        """
    )
    # is_active ← NOT is_verified (legacy inversion — old is_active=true means
    # the schedule was "active", new is_verified=true means it was verified
    # against real JCAP data; we map verified → active, unverified → null)
    op.execute(
        """
        UPDATE hs_code_fee_schedules
        SET is_active = is_verified
        """
    )


def downgrade() -> None:
    op.drop_column("hs_code_fee_schedules", "is_active")
    op.drop_column("hs_code_fee_schedules", "additional_fee")
    op.drop_column("hs_code_fee_schedules", "service_fee")
    op.drop_column("hs_code_fee_schedules", "vat_rate")
    op.drop_column("hs_code_fee_schedules", "duty_rate")

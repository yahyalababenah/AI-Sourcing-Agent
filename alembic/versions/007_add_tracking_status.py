"""Add tracking_status to quotations and create tracking_events table.

Revision ID: 007
Revises: 006
Create Date: 2026-06-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TRACKING_ENUM_NAME = "trackingstatus"


def upgrade() -> None:
    # ── 1. Create the TrackingStatus enum type (idempotent) ──
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{TRACKING_ENUM_NAME}') THEN
                CREATE TYPE {TRACKING_ENUM_NAME} AS ENUM (
                    'awaiting_payment',
                    'production',
                    'inland_freight',
                    'sea_freight',
                    'customs',
                    'delivered'
                );
            END IF;
        END
        $$;
        """
    )

    # ── 2. Add tracking_status column to quotations ──
    op.execute(
        f"""
        ALTER TABLE quotations
        ADD COLUMN IF NOT EXISTS tracking_status {TRACKING_ENUM_NAME};
        """
    )
    op.create_index(
        "ix_quotations_tracking_status",
        "quotations",
        ["tracking_status"],
        postgresql_using="btree",
    )

    # ── 3. Create tracking_events table ──
    op.execute(
        f"""
        CREATE TABLE IF NOT EXISTS tracking_events (
            id UUID PRIMARY KEY,
            quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
            from_status {TRACKING_ENUM_NAME},
            to_status {TRACKING_ENUM_NAME} NOT NULL,
            notes TEXT,
            changed_by_id UUID REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )
    op.create_index(
        "ix_tracking_events_quotation_id",
        "tracking_events",
        ["quotation_id"],
    )
    op.create_index(
        "ix_tracking_events_created_at",
        "tracking_events",
        ["created_at"],
    )


def downgrade() -> None:
    # ── 1. Drop tracking_events table ──
    op.drop_index("ix_tracking_events_created_at", table_name="tracking_events")
    op.drop_index("ix_tracking_events_quotation_id", table_name="tracking_events")
    op.drop_table("tracking_events")

    # ── 2. Remove tracking_status column ──
    op.drop_index("ix_quotations_tracking_status", table_name="quotations")
    op.drop_column("quotations", "tracking_status")

    # ── 3. Drop the enum type ──
    op.execute(f"DROP TYPE IF EXISTS {TRACKING_ENUM_NAME}")

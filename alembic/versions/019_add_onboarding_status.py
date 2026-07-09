"""Add onboarding_status and onboarding_completed_at to users.

Backs the interactive onboarding tour (post-login welcome carousel +
guided tour) so tour progress is a cross-device fact on the user record
instead of living only in browser localStorage — a rep who starts the
tour on a desktop and re-opens the app on their phone should not see it
again.

Revision ID: 019_add_onboarding_status
Revises: 018_quotation_rfq_id_nullable
Create Date: 2026-07-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "019_add_onboarding_status"
down_revision: Union[str, None] = "018_quotation_rfq_id_nullable"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ONBOARDING_ENUM_NAME = "onboardingstatus"


def upgrade() -> None:
    # ── 1. Create the OnboardingStatus enum type (idempotent) ──
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{ONBOARDING_ENUM_NAME}') THEN
                CREATE TYPE {ONBOARDING_ENUM_NAME} AS ENUM (
                    'pending',
                    'active',
                    'snoozed',
                    'completed',
                    'skipped'
                );
            END IF;
        END
        $$;
        """
    )

    # ── 2. Add new columns to users ──
    op.add_column(
        "users",
        sa.Column(
            "onboarding_status",
            sa.Enum(
                "pending", "active", "snoozed", "completed", "skipped",
                name=ONBOARDING_ENUM_NAME,
            ),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "users",
        sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    # ── 1. Drop columns ──
    op.drop_column("users", "onboarding_completed_at")
    op.drop_column("users", "onboarding_status")

    # ── 2. Drop the enum type (only if no other columns use it) ──
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = '{ONBOARDING_ENUM_NAME}') THEN
                DROP TYPE {ONBOARDING_ENUM_NAME};
            END IF;
        END
        $$;
        """
    )

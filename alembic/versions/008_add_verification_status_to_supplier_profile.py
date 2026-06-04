"""Add verification_status, business_license_url, factory_address to supplier_profiles.

Revision ID: 008
Revises: 007
Create Date: 2026-06-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


VERIFICATION_ENUM_NAME = "verificationstatus"


def upgrade() -> None:
    # ── 1. Create the VerificationStatus enum type (idempotent) ──
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{VERIFICATION_ENUM_NAME}') THEN
                CREATE TYPE {VERIFICATION_ENUM_NAME} AS ENUM (
                    'pending',
                    'verified',
                    'rejected'
                );
            END IF;
        END
        $$;
        """
    )

    # ── 2. Add new columns to supplier_profiles ──
    op.add_column(
        "supplier_profiles",
        sa.Column("business_license_url", sa.String(500), nullable=True),
    )
    op.add_column(
        "supplier_profiles",
        sa.Column("factory_address", sa.Text(), nullable=True),
    )
    op.add_column(
        "supplier_profiles",
        sa.Column(
            "verification_status",
            sa.Enum("pending", "verified", "rejected", name=VERIFICATION_ENUM_NAME),
            nullable=False,
            server_default="pending",
        ),
    )


def downgrade() -> None:
    # ── 1. Drop columns ──
    op.drop_column("supplier_profiles", "verification_status")
    op.drop_column("supplier_profiles", "factory_address")
    op.drop_column("supplier_profiles", "business_license_url")

    # ── 2. Drop the enum type (only if no other columns use it) ──
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = '{VERIFICATION_ENUM_NAME}') THEN
                DROP TYPE {VERIFICATION_ENUM_NAME};
            END IF;
        END
        $$;
        """
    )

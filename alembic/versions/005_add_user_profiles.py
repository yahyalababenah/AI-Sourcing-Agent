"""
AI-Sourcing Hub — Add Client & Supplier Profile Tables

Creates:
    - client_profiles   (one-to-one with users for buyer accounts)
    - supplier_profiles (one-to-one with users for seller/agent accounts)

Revision ID: 005
Revises: 004
Create Date: 2026-06-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create client_profiles and supplier_profiles tables."""

    # ── Table: client_profiles ──
    op.create_table(
        "client_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("preferred_port", sa.String(100), nullable=True),
        sa.Column("contact_number", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # ── Table: supplier_profiles ──
    op.create_table(
        "supplier_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True),
        sa.Column("factory_name", sa.String(255), nullable=False),
        sa.Column("location_in_china", sa.String(255), nullable=False),
        sa.Column("specialty", sa.String(255), nullable=True),
        sa.Column("business_registration_number", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    """Drop profile tables in reverse dependency order."""
    op.drop_table("supplier_profiles")
    op.drop_table("client_profiles")

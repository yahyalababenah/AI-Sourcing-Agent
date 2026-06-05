"""Add RFQMatch model + matching fields to RFQ and SupplierProfile

Revision ID: 010
Revises: 009
Create Date: 2026-06-04 19:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add RFQ matching infrastructure.

    1. Create MatchStatus enum type
    2. Add matching columns to rfqs table
    3. Add product_categories to supplier_profiles
    4. Create rfq_matches table with FKs, unique constraint, indexes
    """
    # ── 1. Create MatchStatus enum ──
    sa.Enum(
        "pending", "responded", "expired", "declined",
        name="matchstatus",
    ).create(op.get_bind())

    # ── 2. Add columns to rfqs ──
    op.add_column(
        "rfqs",
        sa.Column(
            "matched_supplier_ids",
            postgresql.JSONB,
            nullable=True,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "rfqs",
        sa.Column(
            "exclusive_deadline",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "rfqs",
        sa.Column(
            "is_public",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # ── 3. Add product_categories to supplier_profiles ──
    op.add_column(
        "supplier_profiles",
        sa.Column(
            "product_categories",
            postgresql.JSONB,
            nullable=True,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )

    # ── 4. Create rfq_matches table ──
    op.create_table(
        "rfq_matches",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("rfq_id", sa.UUID(), nullable=False),
        sa.Column("supplier_id", sa.UUID(), nullable=False),
        sa.Column("match_score", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column("match_reason", sa.Text(), nullable=True),
        sa.Column("response_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM("pending", "responded", "expired", "declined", name="matchstatus", create_type=False),
            nullable=False,
            server_default=sa.text("'pending'::matchstatus"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["rfq_id"], ["rfqs.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["supplier_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("rfq_id", "supplier_id", name="uq_rfq_supplier_match"),
    )

    # Indexes for match queries
    op.create_index("ix_rfq_matches_rfq_id", "rfq_matches", ["rfq_id"])
    op.create_index("ix_rfq_matches_supplier_id", "rfq_matches", ["supplier_id"])
    op.create_index("ix_rfq_matches_status", "rfq_matches", ["status"])

    # Composite index for "show me my pending matches" query
    op.create_index(
        "ix_rfq_matches_supplier_status",
        "rfq_matches",
        ["supplier_id", "status"],
    )


def downgrade() -> None:
    """Remove RFQ matching infrastructure."""
    # Drop rfq_matches table
    op.drop_index("ix_rfq_matches_supplier_status", table_name="rfq_matches")
    op.drop_index("ix_rfq_matches_status", table_name="rfq_matches")
    op.drop_index("ix_rfq_matches_supplier_id", table_name="rfq_matches")
    op.drop_index("ix_rfq_matches_rfq_id", table_name="rfq_matches")
    op.drop_table("rfq_matches")

    # Remove columns from supplier_profiles
    op.drop_column("supplier_profiles", "product_categories")

    # Remove columns from rfqs
    op.drop_column("rfqs", "is_public")
    op.drop_column("rfqs", "exclusive_deadline")
    op.drop_column("rfqs", "matched_supplier_ids")

    # Drop MatchStatus enum
    sa.Enum(name="matchstatus").drop(op.get_bind())

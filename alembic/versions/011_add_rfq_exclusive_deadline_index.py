"""Add composite index on RFQ.is_public and RFQ.exclusive_deadline

The expire_stale_matches() Celery task queries:
    WHERE exclusive_deadline <= now AND is_public = False

This index speeds up that query significantly as the rfqs table grows.

Revision ID: 011
Revises: 010
Create Date: 2026-06-04 23:25:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add composite index on (is_public, exclusive_deadline)."""
    op.create_index(
        "ix_rfq_is_public_exclusive_deadline",
        "rfqs",
        ["is_public", "exclusive_deadline"],
        postgresql_using="btree",
    )


def downgrade() -> None:
    """Drop the composite index."""
    op.drop_index(
        "ix_rfq_is_public_exclusive_deadline",
        table_name="rfqs",
    )

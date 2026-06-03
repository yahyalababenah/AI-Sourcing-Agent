"""
AI-Sourcing Hub — Add client_id to RFQs

Adds a nullable `client_id` foreign key column to the `rfqs` table,
linking RFQs to the `users` table for proper domain isolation.

Columns added:
    - rfqs.client_id (UUID, FK → users.id, nullable, indexed)

Revision ID: 002
Revises: 001
Create Date: 2026-06-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add client_id column to rfqs table."""
    op.add_column(
        "rfqs",
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )


def downgrade() -> None:
    """Remove client_id column from rfqs table."""
    op.drop_index(op.f("ix_rfqs_client_id"), table_name="rfqs")
    op.drop_column("rfqs", "client_id")

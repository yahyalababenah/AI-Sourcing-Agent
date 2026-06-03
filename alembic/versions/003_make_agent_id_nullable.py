"""Make agent_id nullable in rfqs table.

Revision ID: 003
Revises: 002
Create Date: 2026-06-03

Allows RFQs to be created without an assigned agent (unassigned/open),
so any agent can claim them from the pool.

Usage:
    alembic upgrade head
"""

from typing import Union, Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "rfqs",
        "agent_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
        existing_nullable=False,
        existing_server_default=None,
    )


def downgrade() -> None:
    op.alter_column(
        "rfqs",
        "agent_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
        existing_nullable=True,
        existing_server_default=None,
    )

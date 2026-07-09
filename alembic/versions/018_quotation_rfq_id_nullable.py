"""make quotation.rfq_id nullable for standalone quotations

Supports the standalone pricing calculator feature where agents/suppliers
can create quotations without being tied to an RFQ. The rfq_id column on
the quotations table is now nullable, allowing "orphan" quotations.

Revision ID: 018_quotation_rfq_id_nullable
Revises: 017_backward_compat_fields
Create Date: 2026-07-09

NOTE: revision id was originally "018_make_quotation_rfq_id_nullable" (34
chars), which exceeds alembic_version.version_num's VARCHAR(32) column and
made every "alembic upgrade head" run fail (and roll back this whole batch,
including migration 017) with StringDataRightTruncationError. Shortened to
fit.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "018_quotation_rfq_id_nullable"
down_revision = "017_backward_compat_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Make rfq_id nullable on quotations table."""
    op.alter_column(
        "quotations",
        "rfq_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
        existing_server_default=None,
    )


def downgrade() -> None:
    """Revert rfq_id to NOT NULL."""
    op.alter_column(
        "quotations",
        "rfq_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
        existing_server_default=None,
    )

"""Add 'clearance' and 'discount' values to pricingrulecategory enum.

Revision ID: 004
Revises: 003
Create Date: 2026-06-03

The frontend uses 'clearance' and 'discount' as pricing rule categories
in filter buttons and rule forms. This migration adds those values to the
PostgreSQL native ENUM type so that filtering by these categories
does not fail with a 422 validation error.

Usage:
    alembic upgrade head
"""

from typing import Union, Sequence

from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add new enum values to pricingrulecategory.

    PostgreSQL ALTER TYPE ... ADD VALUE IF NOT EXISTS is used to safely
    add the new values without affecting existing rows.
    """
    op.execute(
        "ALTER TYPE pricingrulecategory ADD VALUE IF NOT EXISTS 'clearance'"
    )
    op.execute(
        "ALTER TYPE pricingrulecategory ADD VALUE IF NOT EXISTS 'discount'"
    )


def downgrade() -> None:
    """Remove the enum values by rebuilding the type.

    PostgreSQL does not support removing values from an enum directly.
    To downgrade, we create a new type without the values, alter the
    column to use the new type, then drop the old type.

    NOTE: This assumes no rows currently use 'clearance' or 'discount'.
    If rows exist with those values, the downgrade will fail and a data
    migration would be needed first.
    """
    # Rename old type
    op.execute("ALTER TYPE pricingrulecategory RENAME TO pricingrulecategory_old")

    # Create new type without clearance and discount
    op.execute(
        "CREATE TYPE pricingrulecategory AS ENUM ("
        "'exchange_rate', 'freight', 'customs', 'commission', "
        "'moq_discount', 'tax', 'margin', 'other'"
        ")"
    )

    # Update the column to use the new type
    op.execute(
        "ALTER TABLE pricing_rules ALTER COLUMN category "
        "TYPE pricingrulecategory USING "
        "category::text::pricingrulecategory"
    )

    # Drop the old type
    op.execute("DROP TYPE pricingrulecategory_old")

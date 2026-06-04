"""Add chat rooms and messages tables

Revision ID: 009
Revises: 008
Create Date: 2026-06-04 15:10:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add chat_rooms and chat_messages tables."""
    # Create room_status enum
    sa.Enum("active", "closed", name="roomstatus").create(op.get_bind())

    # --- chat_rooms ---
    op.create_table(
        "chat_rooms",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("rfq_id", sa.UUID(), nullable=True),
        sa.Column("client_id", sa.UUID(), nullable=False),
        sa.Column("supplier_id", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM("active", "closed", name="roomstatus", create_type=False),
            nullable=False,
            server_default=sa.text("'active'::roomstatus"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["rfq_id"], ["rfqs.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["client_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["supplier_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_chat_rooms_client_supplier",
        "chat_rooms",
        ["client_id", "supplier_id"],
        unique=False,
    )
    op.create_index(
        "ix_chat_rooms_updated_at",
        "chat_rooms",
        ["updated_at"],
        unique=False,
    )

    # --- chat_messages ---
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("room_id", sa.UUID(), nullable=False),
        sa.Column("sender_id", sa.UUID(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("original_content", sa.Text(), nullable=True),
        sa.Column("source_lang", sa.String(10), nullable=True),
        sa.Column("target_lang", sa.String(10), nullable=True),
        sa.Column(
            "is_translated",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["room_id"], ["chat_rooms.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["sender_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_chat_messages_room_id",
        "chat_messages",
        ["room_id"],
        unique=False,
    )
    op.create_index(
        "ix_chat_messages_created_at",
        "chat_messages",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Drop chat tables and enum."""
    op.drop_index("ix_chat_messages_created_at", table_name="chat_messages")
    op.drop_index("ix_chat_messages_room_id", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index("ix_chat_rooms_updated_at", table_name="chat_rooms")
    op.drop_index("ix_chat_rooms_client_supplier", table_name="chat_rooms")
    op.drop_table("chat_rooms")
    sa.Enum("active", "closed", name="roomstatus").drop(op.get_bind())

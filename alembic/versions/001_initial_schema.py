"""
AI-Sourcing Hub — Initial Schema Migration

Creates all core tables:
    - users              (auth module)
    - rfqs               (intake module)
    - products           (intake module)
    - documents          (documents module)
    - pricing_rules      (pricing module)
    - quotations         (output module)
    - quotation_line_items (pricing module)
    - ai_cost_log        (cost monitoring, Phase 5)

Revision ID: 001
Revises: None
Create Date: 2026-06-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all initial tables."""

    # ── Enums ──
    # PostgreSQL enums are created implicitly by SQLAlchemy's Enum type
    # when used with create_all. For Alembic, we define them explicitly
    # to ensure proper ordering and avoid dependency issues.

    # UserRole enum
    sa.Enum("admin", "agent", "client", name="userrole").create(op.get_bind(), checkfirst=True)

    # RFQStatus enum
    sa.Enum(
        "open", "processing", "quoted", "closed", "cancelled",
        name="rfqstatus",
    ).create(op.get_bind(), checkfirst=True)

    # ProductStatus enum
    sa.Enum("pending", "quoted", name="productstatus").create(op.get_bind(), checkfirst=True)

    # DocumentType enum
    sa.Enum("pdf", "image", "excel", "other", name="documenttype").create(
        op.get_bind(), checkfirst=True
    )

    # DocumentStatus enum
    sa.Enum(
        "uploaded", "processing", "extracted", "failed",
        name="documentstatus",
    ).create(op.get_bind(), checkfirst=True)

    # PricingRuleCategory enum
    sa.Enum(
        "exchange_rate", "freight", "customs", "commission",
        "moq_discount", "tax", "margin", "other",
        name="pricingrulecategory",
    ).create(op.get_bind(), checkfirst=True)

    # PricingRuleStatus enum
    sa.Enum("active", "inactive", name="pricingrulestatus").create(
        op.get_bind(), checkfirst=True
    )

    # QuotationStatus enum
    sa.Enum(
        "draft", "finalized", "sent", "accepted", "rejected", "expired",
        name="quotationstatus",
    ).create(op.get_bind(), checkfirst=True)

    # ── Table: users ──
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", sa.Enum("admin", "agent", "client", name="userrole"), nullable=False, server_default="agent"),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("preferences", postgresql.JSONB(), nullable=True, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # ── Table: rfqs ──
    op.create_table(
        "rfqs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("client_name", sa.String(255), nullable=True),
        sa.Column("client_phone", sa.String(50), nullable=True),
        sa.Column("client_request_arabic", sa.Text(), nullable=True),
        sa.Column("translated_query_chinese", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum("open", "processing", "quoted", "closed", "cancelled", name="rfqstatus"), nullable=False, server_default="open", index=True),
        sa.Column("extracted_entities", postgresql.JSONB(), nullable=True),
        sa.Column("destination_port", sa.String(100), nullable=True),
        sa.Column("target_currency", sa.String(10), nullable=True, server_default="JOD"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # ── Table: products ──
    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("rfq_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("specifications", sa.Text(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("target_price", sa.Float(precision=10), nullable=True),
        sa.Column("status", sa.Enum("pending", "quoted", name="productstatus"), nullable=False, server_default="pending"),
        sa.Column("extracted_metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # ── Table: documents ──
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("rfq_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("uploaded_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("file_name", sa.String(500), nullable=False),
        sa.Column("file_path", sa.String(1000), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column("doc_type", sa.Enum("pdf", "image", "excel", "other", name="documenttype"), nullable=False, server_default="pdf"),
        sa.Column("status", sa.Enum("uploaded", "processing", "extracted", "failed", name="documentstatus"), nullable=False, server_default="uploaded", index=True),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("extracted_entities", postgresql.JSONB(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # ── Table: pricing_rules ──
    op.create_table(
        "pricing_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.Enum("exchange_rate", "freight", "customs", "commission", "moq_discount", "tax", "margin", "other", name="pricingrulecategory"), nullable=False, index=True),
        sa.Column("rule_type", sa.String(50), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(10), nullable=True),
        sa.Column("conditions", postgresql.JSONB(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("status", sa.Enum("active", "inactive", name="pricingrulestatus"), nullable=False, server_default="active"),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # ── Table: quotations ──
    op.create_table(
        "quotations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("rfq_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("quotation_number", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("status", sa.Enum("draft", "finalized", "sent", "accepted", "rejected", "expired", name="quotationstatus"), nullable=False, server_default="draft", index=True),
        sa.Column("target_currency", sa.String(10), nullable=False, server_default="JOD"),
        sa.Column("exchange_rate_used", sa.Float(), nullable=False),
        sa.Column("subtotal", sa.Float(), nullable=False),
        sa.Column("freight_total", sa.Float(), nullable=True, server_default=sa.text("0.0")),
        sa.Column("customs_total", sa.Float(), nullable=True, server_default=sa.text("0.0")),
        sa.Column("commission_total", sa.Float(), nullable=True, server_default=sa.text("0.0")),
        sa.Column("discount_total", sa.Float(), nullable=True, server_default=sa.text("0.0")),
        sa.Column("vat_total", sa.Float(), nullable=True, server_default=sa.text("0.0")),
        sa.Column("grand_total", sa.Float(), nullable=False),
        sa.Column("payment_terms", sa.Text(), nullable=True),
        sa.Column("delivery_terms", sa.Text(), nullable=True),
        sa.Column("validity_days", sa.Integer(), nullable=False, server_default=sa.text("30")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("pdf_path", sa.String(1000), nullable=True),
        sa.Column("pdf_generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # ── Table: quotation_line_items ──
    op.create_table(
        "quotation_line_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("quotation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_name", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price_cny", sa.Float(), nullable=False),
        sa.Column("unit_price_converted", sa.Float(), nullable=False),
        sa.Column("exchange_rate_used", sa.Float(), nullable=False),
        sa.Column("freight_cost", sa.Float(), nullable=True, server_default=sa.text("0.0")),
        sa.Column("customs_duty", sa.Float(), nullable=True, server_default=sa.text("0.0")),
        sa.Column("commission", sa.Float(), nullable=True, server_default=sa.text("0.0")),
        sa.Column("subtotal", sa.Float(), nullable=False),
        sa.Column("discount", sa.Float(), nullable=True, server_default=sa.text("0.0")),
        sa.Column("total", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # ── Table: ai_cost_log (cost monitoring, Phase 5) ──
    op.create_table(
        "ai_cost_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("rfq_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rfqs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("task_type", sa.String(50), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False),
        sa.Column("completion_tokens", sa.Integer(), nullable=False),
        sa.Column("total_tokens", sa.Integer(), sa.Computed("prompt_tokens + completion_tokens"), nullable=True),
        sa.Column("estimated_cost_usd", sa.DECIMAL(10, 6), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_ai_cost_log_created_at", "ai_cost_log", ["created_at"])
    op.create_index("idx_ai_cost_log_rfq_id", "ai_cost_log", ["rfq_id"])


def downgrade() -> None:
    """Drop all tables in reverse dependency order."""

    # Drop tables (children first, then parents)
    op.drop_table("ai_cost_log")
    op.drop_table("quotation_line_items")
    op.drop_table("quotations")
    op.drop_table("pricing_rules")
    op.drop_table("documents")
    op.drop_table("products")
    op.drop_table("rfqs")
    op.drop_table("users")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS quotationstatus CASCADE")
    op.execute("DROP TYPE IF EXISTS pricingrulestatus CASCADE")
    op.execute("DROP TYPE IF EXISTS pricingrulecategory CASCADE")
    op.execute("DROP TYPE IF EXISTS documentstatus CASCADE")
    op.execute("DROP TYPE IF EXISTS documenttype CASCADE")
    op.execute("DROP TYPE IF EXISTS productstatus CASCADE")
    op.execute("DROP TYPE IF EXISTS rfqstatus CASCADE")
    op.execute("DROP TYPE IF EXISTS userrole CASCADE")

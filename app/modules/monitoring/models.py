"""
AI-Sourcing Hub — Monitoring & Cost Tracking Models

Provides:
    - AiCostLog: Records each LLM/VLM API call with token usage and estimated cost.

Table ``ai_cost_log`` is created by the initial Alembic migration (001_initial_schema).
"""

import uuid

from sqlalchemy import (
    Boolean,
    Column,
    Computed,
    DateTime,
    ForeignKey,
    Integer,
    String,
    DECIMAL,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.shared.database import Base


class AiCostLog(Base):
    """Records each LLM/VLM API call for cost monitoring and reporting.

    Columns:
        id: UUID primary key.
        rfq_id: Optional FK to the RFQ this call is related to.
        document_id: Optional FK to the Document this call is related to.
        provider: API provider name (e.g., "openrouter", "together").
        model: Model name (e.g., "qwen2.5-vl-72b", "gpt-4o").
        task_type: Type of task (e.g., "extract_entities", "translate", "vision_extract").
        prompt_tokens: Number of prompt (input) tokens.
        completion_tokens: Number of completion (output) tokens.
        total_tokens: Computed column: prompt_tokens + completion_tokens.
        estimated_cost_usd: Estimated cost in USD (calculated from token counts).
        latency_ms: Request latency in milliseconds.
        success: Whether the API call succeeded.
        created_at: Timestamp of the API call.
    """

    __tablename__ = "ai_cost_log"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    rfq_id = Column(
        UUID(as_uuid=True),
        ForeignKey("rfqs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    provider = Column(String(50), nullable=False)
    model = Column(String(100), nullable=False)
    task_type = Column(String(50), nullable=False)
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(
        Integer,
        Computed("prompt_tokens + completion_tokens"),
        nullable=True,
    )
    estimated_cost_usd = Column(DECIMAL(10, 6), nullable=False, default=0.0)
    latency_ms = Column(Integer, nullable=False, default=0)
    success = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<AiCostLog(id={self.id}, provider={self.provider}, "
            f"model={self.model}, task={self.task_type}, "
            f"tokens={self.total_tokens}, cost=${self.estimated_cost_usd})>"
        )

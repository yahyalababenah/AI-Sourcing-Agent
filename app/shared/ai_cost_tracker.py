"""
AI-Sourcing Hub — AI Cost Tracking Utility

Provides:
1. A ``log_ai_cost`` async function for FastAPI route handlers.
2. A ``log_ai_cost_sync`` function for Celery task workers.
3. Model pricing lookup to estimate cost from token counts.
4. Prometheus metric updates (vision_api_calls_total, vision_api_cost_total).

Usage (async):
    from app.shared.ai_cost_tracker import log_ai_cost
    await log_ai_cost(
        db=db,
        provider="openrouter",
        model="qwen2.5-vl-72b",
        task_type="vision_extract",
        prompt_tokens=500,
        completion_tokens=200,
        latency_ms=3200,
        success=True,
        rfq_id=rfq_id,
        document_id=doc_id,
    )

Usage (sync — Celery):
    from app.shared.ai_cost_tracker import log_ai_cost_sync
    log_ai_cost_sync(
        db=db_session,
        provider="together",
        model="qwen2.5-vl-72b",
        task_type="vision_extract",
        prompt_tokens=500,
        completion_tokens=200,
        latency_ms=3200,
        success=True,
    )
"""

from decimal import Decimal
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.shared.logging import get_logger
from app.shared.metrics import record_vision_api_call

logger = get_logger(__name__)

# ═══════════════════════════════════════════════════════════
# Model Pricing Tables (per 1K tokens, in USD)
# Derived from OpenRouter / Together AI published pricing.
# ═══════════════════════════════════════════════════════════

_MODEL_PRICING: dict[str, dict[str, float]] = {
    # ---- Vision Models ----
    "qwen2.5-vl-72b": {
        "provider": "together",
        "prompt_per_1k": 0.0015,
        "completion_per_1k": 0.0015,
    },
    "qwen2.5-vl-7b": {
        "provider": "together",
        "prompt_per_1k": 0.0005,
        "completion_per_1k": 0.0005,
    },
    "qwen2.5-vl-72b-instruct": {
        "provider": "openrouter",
        "prompt_per_1k": 0.0015,
        "completion_per_1k": 0.0015,
    },
    "gpt-4o": {
        "provider": "openai",
        "prompt_per_1k": 0.005,
        "completion_per_1k": 0.015,
    },
    "gpt-4o-mini": {
        "provider": "openai",
        "prompt_per_1k": 0.00015,
        "completion_per_1k": 0.0006,
    },
    "claude-3-opus": {
        "provider": "anthropic",
        "prompt_per_1k": 0.015,
        "completion_per_1k": 0.075,
    },
    "claude-3-sonnet": {
        "provider": "anthropic",
        "prompt_per_1k": 0.003,
        "completion_per_1k": 0.015,
    },
    "claude-3-haiku": {
        "provider": "anthropic",
        "prompt_per_1k": 0.00025,
        "completion_per_1k": 0.00125,
    },
    # ---- Text Models ----
    "gemini-2.0-flash": {
        "provider": "google",
        "prompt_per_1k": 0.0001,
        "completion_per_1k": 0.0004,
    },
    "deepseek-chat": {
        "provider": "deepseek",
        "prompt_per_1k": 0.00027,
        "completion_per_1k": 0.0011,
    },
    "llama-3.1-70b": {
        "provider": "together",
        "prompt_per_1k": 0.00059,
        "completion_per_1k": 0.00079,
    },
    "llama-3.1-8b": {
        "provider": "together",
        "prompt_per_1k": 0.00018,
        "completion_per_1k": 0.00018,
    },
}

# Default pricing for unknown models (conservative estimate)
_DEFAULT_PROMPT_PRICE = 0.0015  # per 1K tokens
_DEFAULT_COMPLETION_PRICE = 0.0020  # per 1K tokens


def _estimate_cost(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> Decimal:
    """Estimate the cost of an API call based on token usage and model pricing.

    Args:
        model: Model name (e.g., "qwen2.5-vl-72b").
        prompt_tokens: Number of input tokens.
        completion_tokens: Number of output tokens.

    Returns:
        Estimated cost in USD as a Decimal.
    """
    pricing = _MODEL_PRICING.get(model, {})
    prompt_price = pricing.get("prompt_per_1k", _DEFAULT_PROMPT_PRICE)
    completion_price = pricing.get("completion_per_1k", _DEFAULT_COMPLETION_PRICE)

    cost = (prompt_tokens / 1000) * prompt_price + (
        completion_tokens / 1000
    ) * completion_price

    return Decimal(str(round(cost, 6)))


# ═══════════════════════════════════════════════════════════
# Async Version (FastAPI route handlers)
# ═══════════════════════════════════════════════════════════


async def log_ai_cost(
    db: AsyncSession,
    provider: str,
    model: str,
    task_type: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    latency_ms: int = 0,
    success: bool = True,
    rfq_id: Optional[str] = None,
    document_id: Optional[str] = None,
) -> None:
    """Log an AI API call cost to the database and update Prometheus metrics.

    Args:
        db: Async SQLAlchemy session.
        provider: API provider name (e.g., "openrouter", "together").
        model: Model name (e.g., "qwen2.5-vl-72b", "gpt-4o").
        task_type: Type of task (e.g., "extract_entities", "vision_extract").
        prompt_tokens: Number of input tokens.
        completion_tokens: Number of output tokens.
        latency_ms: Request latency in milliseconds.
        success: Whether the API call succeeded.
        rfq_id: Optional RFQ UUID string.
        document_id: Optional Document UUID string.
    """
    estimated_cost = _estimate_cost(model, prompt_tokens, completion_tokens)

    try:
        # Insert into database
        stmt = text("""
            INSERT INTO ai_cost_log
                (provider, model, task_type, prompt_tokens, completion_tokens,
                 estimated_cost_usd, latency_ms, success, rfq_id, document_id)
            VALUES
                (:provider, :model, :task_type, :prompt_tokens, :completion_tokens,
                 :estimated_cost, :latency_ms, :success, :rfq_id, :document_id)
        """)
        await db.execute(
            stmt,
            {
                "provider": provider,
                "model": model,
                "task_type": task_type,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "estimated_cost": estimated_cost,
                "latency_ms": latency_ms,
                "success": success,
                "rfq_id": rfq_id,
                "document_id": document_id,
            },
        )
        await db.commit()

        # Update Prometheus metrics
        record_vision_api_call(
            provider=provider,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            estimated_cost=float(estimated_cost),
        )

        logger.info(
            "AI cost logged",
            extra={
                "provider": provider,
                "model": model,
                "task_type": task_type,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "estimated_cost": str(estimated_cost),
                "latency_ms": latency_ms,
                "success": success,
            },
        )

    except Exception as exc:
        logger.error(
            "Failed to log AI cost",
            extra={
                "error": str(exc),
                "provider": provider,
                "model": model,
                "task_type": task_type,
            },
        )


# ═══════════════════════════════════════════════════════════
# Sync Version (Celery task workers)
# ═══════════════════════════════════════════════════════════


def log_ai_cost_sync(
    db: Session,
    provider: str,
    model: str,
    task_type: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    latency_ms: int = 0,
    success: bool = True,
    rfq_id: Optional[str] = None,
    document_id: Optional[str] = None,
) -> None:
    """Sync version of :func:`log_ai_cost` for use in Celery tasks.

    Args:
        db: Sync SQLAlchemy session.
        provider: API provider name.
        model: Model name.
        task_type: Type of task.
        prompt_tokens: Number of input tokens.
        completion_tokens: Number of output tokens.
        latency_ms: Request latency in milliseconds.
        success: Whether the API call succeeded.
        rfq_id: Optional RFQ UUID string.
        document_id: Optional Document UUID string.
    """
    estimated_cost = _estimate_cost(model, prompt_tokens, completion_tokens)

    try:
        stmt = text("""
            INSERT INTO ai_cost_log
                (provider, model, task_type, prompt_tokens, completion_tokens,
                 estimated_cost_usd, latency_ms, success, rfq_id, document_id)
            VALUES
                (:provider, :model, :task_type, :prompt_tokens, :completion_tokens,
                 :estimated_cost, :latency_ms, :success, :rfq_id, :document_id)
        """)
        db.execute(
            stmt,
            {
                "provider": provider,
                "model": model,
                "task_type": task_type,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "estimated_cost": estimated_cost,
                "latency_ms": latency_ms,
                "success": success,
                "rfq_id": rfq_id,
                "document_id": document_id,
            },
        )
        db.commit()

        # Update Prometheus metrics
        record_vision_api_call(
            provider=provider,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            estimated_cost=float(estimated_cost),
        )

        logger.info(
            "AI cost logged (sync)",
            extra={
                "provider": provider,
                "model": model,
                "task_type": task_type,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "estimated_cost": str(estimated_cost),
                "latency_ms": latency_ms,
                "success": success,
            },
        )

    except Exception as exc:
        db.rollback()
        logger.error(
            "Failed to log AI cost (sync)",
            extra={
                "error": str(exc),
                "provider": provider,
                "model": model,
                "task_type": task_type,
            },
        )

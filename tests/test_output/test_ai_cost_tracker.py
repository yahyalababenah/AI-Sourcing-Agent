"""
Tests for the AI Cost Tracker.

Covers:
    - Cost estimation from token counts and model pricing
    - Async log_ai_cost function
    - Sync log_ai_cost_sync function
    - Error handling (fail open on DB errors)
"""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.shared.ai_cost_tracker import (
    _estimate_cost,
    log_ai_cost,
    log_ai_cost_sync,
)

# ═══════════════════════════════════════════════════════════
# Unit Tests: Cost Estimation
# ═══════════════════════════════════════════════════════════


class TestEstimateCost:
    """Tests for ``_estimate_cost()``."""

    def test_known_model_pricing(self):
        """Should estimate cost using known model pricing."""
        # qwen2.5-vl-72b: prompt=$0.0015/1K, completion=$0.0015/1K
        # 1000 prompt tokens + 500 completion tokens
        cost = _estimate_cost("qwen2.5-vl-72b", 1000, 500)
        expected = Decimal("0.002250")  # (1 * 0.0015) + (0.5 * 0.0015)
        assert cost == expected

    def test_unknown_model_default_pricing(self):
        """Should use default pricing for unknown models."""
        cost = _estimate_cost("unknown-model", 1000, 1000)
        expected = Decimal("0.003500")  # (1 * 0.0015) + (1 * 0.0020)
        assert cost == expected

    def test_zero_tokens(self):
        """Zero tokens should result in zero cost."""
        cost = _estimate_cost("gpt-4o", 0, 0)
        assert cost == Decimal("0.000000")

    def test_gpt4o_pricing(self):
        """Should correctly estimate GPT-4o costs."""
        # gpt-4o: prompt=$0.005/1K, completion=$0.015/1K
        cost = _estimate_cost("gpt-4o", 500, 200)
        expected = Decimal("0.005500")  # (0.5 * 0.005) + (0.2 * 0.015)
        assert cost == expected

    def test_gpt4o_mini_pricing(self):
        """Should correctly estimate GPT-4o-mini costs (cheaper)."""
        cost = _estimate_cost("gpt-4o-mini", 1000, 500)
        expected = Decimal("0.000450")  # (1 * 0.00015) + (0.5 * 0.0006)
        assert cost == expected


# ═══════════════════════════════════════════════════════════
# Tests: Async log_ai_cost
# ═══════════════════════════════════════════════════════════


class TestLogAiCost:
    """Tests for async ``log_ai_cost()``."""

    @pytest.mark.asyncio
    @patch("app.shared.ai_cost_tracker.record_vision_api_call")
    async def test_logs_to_database(self, mock_record):
        """Should insert a cost log entry and update metrics."""
        db = AsyncMock()
        db.execute.return_value = None
        db.commit.return_value = None

        await log_ai_cost(
            db=db,
            provider="openrouter",
            model="qwen2.5-vl-72b",
            task_type="vision_extract",
            prompt_tokens=500,
            completion_tokens=200,
            latency_ms=3200,
            success=True,
            rfq_id="rfq-123",
            document_id="doc-456",
        )

        # Should execute INSERT
        assert db.execute.called
        call_args = db.execute.call_args
        sql = call_args[0][0]  # The SQL text
        params = call_args[0][1]  # The parameters dict

        assert "INSERT INTO ai_cost_log" in str(sql)
        assert params["provider"] == "openrouter"
        assert params["model"] == "qwen2.5-vl-72b"
        assert params["task_type"] == "vision_extract"
        assert params["prompt_tokens"] == 500
        assert params["completion_tokens"] == 200
        assert params["rfq_id"] == "rfq-123"
        assert params["document_id"] == "doc-456"

        # Should commit
        assert db.commit.called

        # Should update Prometheus metrics
        assert mock_record.called

    @pytest.mark.asyncio
    @patch("app.shared.ai_cost_tracker.record_vision_api_call")
    async def test_handles_db_error_gracefully(self, mock_record):
        """Should log an error but not raise if DB insert fails."""
        db = AsyncMock()
        db.execute.side_effect = Exception("DB connection error")

        # Should not raise
        await log_ai_cost(
            db=db,
            provider="together",
            model="llama-3.1-70b",
            task_type="translate",
            prompt_tokens=100,
            completion_tokens=50,
            latency_ms=500,
            success=True,
        )

        # Should NOT commit on error
        assert not db.commit.called


# ═══════════════════════════════════════════════════════════
# Tests: Sync log_ai_cost_sync
# ═══════════════════════════════════════════════════════════


class TestLogAiCostSync:
    """Tests for sync ``log_ai_cost_sync()``."""

    @patch("app.shared.ai_cost_tracker.record_vision_api_call")
    def test_logs_to_database_sync(self, mock_record):
        """Should insert a cost log entry using sync DB session."""
        db = MagicMock()
        db.execute.return_value = None

        log_ai_cost_sync(
            db=db,
            provider="together",
            model="qwen2.5-vl-7b",
            task_type="vision_extract",
            prompt_tokens=300,
            completion_tokens=100,
            latency_ms=1500,
            success=True,
        )

        assert db.execute.called
        assert db.commit.called
        assert mock_record.called

    @patch("app.shared.ai_cost_tracker.record_vision_api_call")
    def test_handles_db_error_gracefully_sync(self, mock_record):
        """Should rollback and log error but not raise."""
        db = MagicMock()
        db.execute.side_effect = Exception("Sync DB error")

        # Should not raise
        log_ai_cost_sync(
            db=db,
            provider="anthropic",
            model="claude-3-haiku",
            task_type="extract_entities",
            prompt_tokens=50,
            completion_tokens=20,
            latency_ms=800,
            success=False,
        )

        # Should rollback
        assert db.rollback.called
        # Should NOT commit
        assert not db.commit.called

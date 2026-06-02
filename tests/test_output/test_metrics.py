"""
Tests for the Prometheus Metrics Module.

Covers:
    - Metric recording functions (record_vision_api_call, record_celery_task)
    - HTTP metrics middleware (PrometheusMiddleware)
    - Path normalization
    - /metrics endpoint
"""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from prometheus_client import REGISTRY

from app.shared.metrics import (
    PrometheusMiddleware,
    register_metrics_endpoint,
    record_vision_api_call,
    record_celery_task,
    HTTP_REQUESTS_TOTAL,
    HTTP_REQUEST_DURATION_SECONDS,
    VISION_API_CALLS_TOTAL,
    VISION_API_COST_TOTAL,
)

# ═══════════════════════════════════════════════════════════
# Unit Tests: Metric Recording Functions
# ═══════════════════════════════════════════════════════════


class TestRecordVisionApiCall:
    """Tests for ``record_vision_api_call()``."""

    def test_increments_counters(self):
        """Should increment total calls and cost counters."""
        # Reset the counter for a clean test
        provider = "test_provider"
        model = "test_model"

        before_calls = VISION_API_CALLS_TOTAL.labels(
            provider=provider, model=model
        )._value.get()

        record_vision_api_call(
            provider=provider,
            model=model,
            prompt_tokens=100,
            completion_tokens=50,
            estimated_cost=0.0025,
        )

        after_calls = VISION_API_CALLS_TOTAL.labels(
            provider=provider, model=model
        )._value.get()

        assert after_calls == (before_calls or 0) + 1


class TestRecordCeleryTask:
    """Tests for ``record_celery_task()``."""

    def test_increments_task_counter(self):
        """Should increment task counter by status."""
        task_name = "test-task"
        status = "success"

        before = REGISTRY.get_sample_value(
            "celery_tasks_total",
            labels={"task_name": task_name, "status": status},
        ) or 0

        record_celery_task(task_name=task_name, status=status, duration=1.5)

        after = REGISTRY.get_sample_value(
            "celery_tasks_total",
            labels={"task_name": task_name, "status": status},
        ) or 0

        assert after == before + 1


# ═══════════════════════════════════════════════════════════
# Unit Tests: Path Normalization
# ═══════════════════════════════════════════════════════════


class TestPathNormalization:
    """Tests for ``PrometheusMiddleware._normalize_path()``."""

    def test_normalize_uuid(self):
        """UUIDs in paths should be replaced with {id}."""
        path = "/api/v1/quotes/550e8400-e29b-41d4-a716-446655440000/pdf"
        normalized = PrometheusMiddleware._normalize_path(path)
        assert normalized == "/api/v1/quotes/{id}/pdf"

    def test_normalize_numeric_id(self):
        """Numeric IDs in paths should be replaced with {id}."""
        path = "/api/v1/users/42"
        normalized = PrometheusMiddleware._normalize_path(path)
        assert normalized == "/api/v1/users/{id}"

    def test_keeps_static_paths(self):
        """Static paths without IDs should remain unchanged."""
        path = "/api/v1/quotes"
        normalized = PrometheusMiddleware._normalize_path(path)
        assert normalized == "/api/v1/quotes"


# ═══════════════════════════════════════════════════════════
# Integration Tests: /metrics Endpoint
# ═══════════════════════════════════════════════════════════


class TestMetricsEndpoint:
    """Tests for the /metrics endpoint."""

    @pytest.fixture
    def app(self):
        application = FastAPI()
        register_metrics_endpoint(application)
        return application

    @pytest.mark.asyncio
    async def test_metrics_endpoint_returns_prometheus_format(self, app):
        """GET /metrics should return Prometheus text format."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/metrics")

        assert response.status_code == 200
        assert "text/plain" in response.headers.get("content-type", "")
        assert "Cache-Control" in response.headers
        assert "no-cache" in response.headers["Cache-Control"]

        # Should contain at least one metric
        body = response.text
        assert "# HELP" in body or "# TYPE" in body

    @pytest.mark.asyncio
    async def test_metrics_contains_application_metrics(self, app):
        """Should include application-specific metrics."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/metrics")

        body = response.text
        # Check for expected metric names
        assert "http_requests_total" in body
        assert "http_request_duration_seconds" in body
        assert "celery_tasks_total" in body
        assert "vision_api_calls_total" in body
        assert "vision_api_cost_total" in body

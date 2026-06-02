"""
AI-Sourcing Hub — Prometheus Metrics

Provides:
1. HTTP request metrics middleware (count + duration histogram)
2. Celery task tracking via signals (task count by name + status)
3. Vision API call/cost counters
4. /metrics endpoint registration

Usage:
    from app.shared.metrics import register_metrics_endpoint, setup_celery_metrics

    # In create_app():
        register_metrics_endpoint(app)

    # At Celery worker startup:
        setup_celery_metrics()
"""

import time
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import FastAPI, Request, Response
from prometheus_client import Counter, Histogram, generate_latest, REGISTRY
from prometheus_client.core import REGISTRY as CORE_REGISTRY
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse
from starlette.types import ASGIApp

from app.shared.logging import get_logger

logger = get_logger(__name__)

# ---- HTTP Metrics ----

HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests by method, endpoint, and status code",
    labelnames=["method", "endpoint", "status"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    labelnames=["method", "endpoint"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)

# ---- Celery Task Metrics ----

CELERY_TASKS_TOTAL = Counter(
    "celery_tasks_total",
    "Total Celery tasks by task name and status",
    labelnames=["task_name", "status"],
)

CELERY_TASK_DURATION_SECONDS = Histogram(
    "celery_task_duration_seconds",
    "Celery task duration in seconds",
    labelnames=["task_name"],
    buckets=(0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0),
)

# ---- Vision / LLM API Metrics ----

VISION_API_CALLS_TOTAL = Counter(
    "vision_api_calls_total",
    "Total Vision/LLM API calls by provider and model",
    labelnames=["provider", "model"],
)

VISION_API_COST_TOTAL = Counter(
    "vision_api_cost_total",
    "Estimated total cost of Vision/LLM API calls in USD",
    labelnames=["provider", "model"],
)

VISION_API_TOKENS_TOTAL = Counter(
    "vision_api_tokens_total",
    "Total tokens used by Vision/LLM API calls",
    labelnames=["provider", "model", "token_type"],  # token_type: prompt, completion
)


# ---- Metric Recording Functions ----

def record_vision_api_call(
    provider: str,
    model: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    estimated_cost: float = 0.0,
) -> None:
    """Record a Vision/LLM API call in Prometheus metrics.

    Args:
        provider: API provider name (e.g., "openrouter", "together").
        model: Model name (e.g., "gpt-4o", "claude-3-opus").
        prompt_tokens: Number of prompt tokens used.
        completion_tokens: Number of completion tokens used.
        estimated_cost: Estimated cost in USD.
    """
    VISION_API_CALLS_TOTAL.labels(provider=provider, model=model).inc()

    if estimated_cost > 0:
        VISION_API_COST_TOTAL.labels(provider=provider, model=model).inc(estimated_cost)

    if prompt_tokens > 0:
        VISION_API_TOKENS_TOTAL.labels(
            provider=provider, model=model, token_type="prompt"
        ).inc(prompt_tokens)

    if completion_tokens > 0:
        VISION_API_TOKENS_TOTAL.labels(
            provider=provider, model=model, token_type="completion"
        ).inc(completion_tokens)


def record_celery_task(task_name: str, status: str, duration: float = 0.0) -> None:
    """Record a Celery task execution in Prometheus metrics.

    Args:
        task_name: Name of the Celery task (e.g., "process-document-vision").
        status: Task outcome ("success", "failure", "retry").
        duration: Task duration in seconds.
    """
    CELERY_TASKS_TOTAL.labels(task_name=task_name, status=status).inc()

    if duration > 0:
        CELERY_TASK_DURATION_SECONDS.labels(task_name=task_name).observe(duration)


# ---- HTTP Metrics Middleware ----

class PrometheusMiddleware(BaseHTTPMiddleware):
    """Middleware that tracks HTTP request count and duration.

    Records:
        - http_requests_total by method, endpoint, status
        - http_request_duration_seconds by method, endpoint
    """

    # Paths to exclude from metrics (to avoid noise / recursion)
    EXCLUDED_PATHS = {"/metrics", "/health"}

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Record HTTP metrics for the request."""
        path = request.url.path

        # Normalize path: replace UUIDs and int IDs with a placeholder
        endpoint = self._normalize_path(path)

        # Skip excluded paths
        if endpoint in self.EXCLUDED_PATHS:
            return await call_next(request)

        method = request.method
        start_time = time.monotonic()

        try:
            response = await call_next(request)
            status = str(response.status_code)
            duration = time.monotonic() - start_time

            HTTP_REQUESTS_TOTAL.labels(
                method=method, endpoint=endpoint, status=status
            ).inc()
            HTTP_REQUEST_DURATION_SECONDS.labels(
                method=method, endpoint=endpoint
            ).observe(duration)

            return response

        except Exception as exc:
            duration = time.monotonic() - start_time
            status = "500"

            HTTP_REQUESTS_TOTAL.labels(
                method=method, endpoint=endpoint, status=status
            ).inc()
            HTTP_REQUEST_DURATION_SECONDS.labels(
                method=method, endpoint=endpoint
            ).observe(duration)

            raise

    @staticmethod
    def _normalize_path(path: str) -> str:
        """Normalize dynamic path segments for metric labeling.

        Replaces UUIDs and numeric IDs with ``{id}`` placeholder
        to avoid unbounded label cardinality.

        Args:
            path: The raw request URL path.

        Returns:
            Normalized path with dynamic segments replaced.
        """
        import re

        # Replace UUIDs
        path = re.sub(
            r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            "/{id}",
            path,
        )
        # Replace integer IDs
        path = re.sub(r"/\d+", "/{id}", path)
        return path


# ---- Metrics Endpoint ----

def register_metrics_endpoint(app: FastAPI) -> None:
    """Register the ``/metrics`` endpoint on the FastAPI application.

    Exposes all registered Prometheus metrics in text format.

    Args:
        app: The FastAPI application instance.
    """

    @app.get(
        "/metrics",
        tags=["System"],
        summary="Prometheus metrics endpoint",
        description="Exposes application and system metrics in Prometheus text format. "
                    "Used by Prometheus server for scraping.",
        include_in_schema=True,
    )
    async def metrics_endpoint() -> StarletteResponse:
        """Return all Prometheus metrics in text/plain format."""
        from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

        data = generate_latest()
        return StarletteResponse(
            content=data,
            media_type=CONTENT_TYPE_LATEST,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
        )


# ---- Celery Signal Handlers ----

def setup_celery_metrics() -> None:
    """Connect Celery signal handlers to track task metrics.

    Call this at Celery worker startup (usually in ``celery_app.py``
    or ``celery_worker.py``).

    Tracks:
        - Task success/failure/retry counts
        - Task duration
    """
    try:
        from celery import signals as celery_signals
    except ImportError:
        logger.warning("Celery not available — skipping Celery metrics setup")
        return

    @celery_signals.task_prerun.connect
    def _on_task_prerun(task_id: str, task: Any, **kwargs: Any) -> None:
        """Store start time on the task request."""
        task.request._prometheus_start_time = time.monotonic()

    @celery_signals.task_postrun.connect
    def _on_task_postrun(
        task_id: str,
        task: Any,
        state: str,
        retval: Any,
        **kwargs: Any,
    ) -> None:
        """Record task execution on completion."""
        task_name = task.name or "unknown"
        duration = 0.0
        start_time = getattr(task.request, "_prometheus_start_time", None)
        if start_time is not None:
            duration = time.monotonic() - start_time

        status = "success" if state == "SUCCESS" else state.lower()
        record_celery_task(task_name=task_name, status=status, duration=duration)

    @celery_signals.task_failure.connect
    def _on_task_failure(
        task_id: str,
        task: Any,
        exception: Exception,
        **kwargs: Any,
    ) -> None:
        """Record task failure."""
        task_name = task.name or "unknown"
        duration = 0.0
        start_time = getattr(task.request, "_prometheus_start_time", None)
        if start_time is not None:
            duration = time.monotonic() - start_time

        record_celery_task(task_name=task_name, status="failure", duration=duration)

    @celery_signals.task_retry.connect
    def _on_task_retry(
        task_id: str,
        task: Any,
        exception: Exception,
        **kwargs: Any,
    ) -> None:
        """Record task retry."""
        task_name = task.name or "unknown"
        record_celery_task(task_name=task_name, status="retry")

    logger.info("Celery Prometheus metrics handlers registered")

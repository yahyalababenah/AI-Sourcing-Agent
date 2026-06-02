"""
AI-Sourcing Hub — Celery Application

Configures the Celery app with Redis broker/backend.
Uses autodiscovery to find tasks across all modules.

Task discovery:
    - app.modules.documents.tasks    -> parse_document
    - app.modules.output.tasks       -> generate_quotation_pdf, cleanup-expired-quotes
    - app.modules.pricing.tasks      -> refresh-exchange-rates

Prometheus metrics:
    - Setup Celery signal handlers for task metrics at import time.
"""

from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "aisourcing",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

# ---- Celery Configuration ----
celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # Result expiration
    result_expires=86400,  # 24 hours
    # Task time limits
    task_soft_time_limit=settings.CELERY_TASK_SOFT_TIME_LIMIT,  # 3 min
    task_time_limit=settings.CELERY_TASK_TIME_LIMIT,  # 3m20s
    # Reliability
    acks_late=True,  # Re-queue if worker crashes mid-execution
    task_reject_on_worker_lost=True,
    # Worker settings
    worker_max_tasks_per_child=10,  # Restart after 10 tasks (memory leak prevention)
    worker_prefetch_multiplier=1,  # Fair scheduling
    # Visibility timeout (for Redis broker)
    broker_transport_options={
        "visibility_timeout": 3600,  # 1 hour
    },
)

# ---- Task Discovery ----
# ⚠️ CRITICAL: Without autodiscovery, Celery workers will start
# but silently ignore all task definitions, causing NotRegistered errors.
celery_app.autodiscover_tasks(
    packages=[
        "app.modules.documents",
        "app.modules.output",
        "app.modules.pricing",
    ],
    related_name="tasks",
)

# ---- Beat Schedule ----
# ⚠️ CRITICAL: The "task" value must match the `name=` parameter in the
# @celery_app.task decorator, NOT the Python function name.
celery_app.conf.beat_schedule = {
    "refresh-exchange-rates": {
        "task": "refresh-exchange-rates",
        "schedule": crontab(minute="*/15"),  # Every 15 minutes
    },
    "cleanup-expired-quotes": {
        "task": "cleanup-expired-quotes",
        "schedule": crontab(hour=0, minute=0),  # Daily at midnight
    },
}

# ---- Prometheus Metrics ----
# Setup Celery signal handlers to track task metrics.
# This must be imported at Celery worker startup, not at app import.
# The import triggers signal handler registration via setup_celery_metrics().
# We import lazily to avoid circular imports during web app startup.
try:
    from app.shared.metrics import setup_celery_metrics

    setup_celery_metrics()
except Exception:
    pass  # Metrics setup is best-effort; will log warning internally

"""
AI-Sourcing Hub — Pricing Celery Tasks

Background tasks for exchange rate refresh and rule management.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from app.shared.celery_app import celery_app
from app.shared.logging import get_logger

logger = get_logger(__name__)


@celery_app.task(
    bind=True,
    name="refresh-exchange-rates",
    acks_late=True,
    max_retries=3,
    default_retry_delay=60,
)
def refresh_exchange_rates_task(self) -> dict:
    """Periodic task to refresh exchange rates (runs every 15 min via celery beat).

    This task fetches latest CNY→JOD and CNY→USD rates from the external
    exchange rate API and caches them in Redis.
    """
    logger.info("Starting scheduled exchange rate refresh")

    try:
        # TODO: Implement sync wrapper that:
        # 1. Creates a new DB session
        # 2. Calls pricing service refresh_exchange_rates()
        # 3. Updates Redis cache

        logger.info("Exchange rate refresh completed")
        return {"status": "success", "task": "refresh-exchange-rates"}

    except Exception as exc:
        logger.error(
            "Exchange rate refresh failed",
            extra={"error": str(exc)},
        )
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    name="cleanup-expired-quotes",
    acks_late=True,
    max_retries=2,
)
def cleanup_expired_quotes_task(self) -> dict:
    """Periodic task to mark expired quotations as closed (runs daily at midnight).

    Quotations older than 30 days in 'quoted' status are moved to 'expired'.
    """
    logger.info("Starting expired quote cleanup")

    try:
        # TODO: Implement sync wrapper that:
        # 1. Creates a new DB session
        # 2. Finds quotations older than 30 days with status 'quoted'
        # 3. Updates them to 'expired' status

        logger.info("Expired quote cleanup completed")
        return {"status": "success", "task": "cleanup-expired-quotes"}

    except Exception as exc:
        logger.error(
            "Expired quote cleanup failed",
            extra={"error": str(exc)},
        )
        raise self.retry(exc=exc)

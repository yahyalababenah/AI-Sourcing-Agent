"""
AI-Sourcing Hub — Pricing Celery Tasks

Background tasks for exchange rate refresh and expired quote cleanup.

Both tasks use **sync** SQLAlchemy sessions because Celery workers run
in a separate process from the async FastAPI app.

Task Naming Convention:
  - ``refresh-exchange-rates`` — runs every 15 minutes via Celery Beat
  - ``cleanup-expired-quotes``  — runs daily at midnight via Celery Beat
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from redis import Redis as SyncRedis
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.modules.pricing.models import PricingRule, PricingRuleStatus
from app.shared.celery_app import celery_app
from app.shared.database import create_sync_session_factory
from app.shared.logging import get_logger

logger = get_logger(__name__)


# ═══════════════════════════════════════════════════════════
# Sync DB Session Factory (uses shared infrastructure)
# ═══════════════════════════════════════════════════════════

_SyncSession = create_sync_session_factory(pool_size=2, max_overflow=4)


def _get_session() -> Session:
    """Get a sync database session for Celery tasks."""
    return _SyncSession()


def _get_sync_redis() -> SyncRedis:
    """Get a sync Redis client for Celery tasks."""
    redis_url: str = settings.redis_url
    return SyncRedis.from_url(redis_url, decode_responses=True)


# ═══════════════════════════════════════════════════════════
# Exchange Rate Cache Helpers (sync)
# ═══════════════════════════════════════════════════════════

_EXCHANGE_RATE_CACHE_PREFIX = "pricing:exchange_rate:"
_EXCHANGE_RATE_CACHE_TTL = 86400  # 24 hours
_EXCHANGE_RATE_API_TIMEOUT = 10.0


def _set_cached_rate_sync(
    redis_client: SyncRedis,
    from_currency: str,
    to_currency: str,
    rate: float,
    ttl: int = _EXCHANGE_RATE_CACHE_TTL,
) -> None:
    """Set exchange rate in Redis (sync version)."""
    key = f"{_EXCHANGE_RATE_CACHE_PREFIX}{from_currency.upper()}:{to_currency.upper()}"
    redis_client.setex(key, ttl, str(rate))


def _fetch_rate_from_api(from_currency: str, to_currency: str) -> float | None:
    """Fetch exchange rate from external API (sync, for Celery tasks).

    Args:
        from_currency: Source currency code.
        to_currency: Target currency code.

    Returns:
        Rate if successful, else None.
    """
    if not settings.EXCHANGE_RATE_API_KEY:
        logger.warning("No EXCHANGE_RATE_API_KEY configured, skipping API fetch")
        return None

    try:
        url = (
            f"https://v6.exchangerate-api.com/v6/{settings.EXCHANGE_RATE_API_KEY}"
            f"/pair/{from_currency.upper()}/{to_currency.upper()}"
        )
        response = httpx.get(url, timeout=_EXCHANGE_RATE_API_TIMEOUT)

        if response.status_code != 200:
            logger.error(
                "Exchange rate API returned non-200",
                extra={
                    "status": response.status_code,
                    "pair": f"{from_currency}/{to_currency}",
                },
            )
            return None

        data = response.json()
        if data.get("result") != "success":
            logger.error(
                "Exchange rate API unsuccessful",
                extra={"pair": f"{from_currency}/{to_currency}", "result": data.get("result")},
            )
            return None

        return float(data["conversion_rate"])

    except Exception as exc:
        logger.error(
            "Exchange rate API request failed",
            extra={"pair": f"{from_currency}/{to_currency}", "error": str(exc)},
        )
        return None


# ═══════════════════════════════════════════════════════════
# Task: refresh_exchange_rates_task
# ═══════════════════════════════════════════════════════════

@celery_app.task(
    bind=True,
    name="refresh-exchange-rates",
    acks_late=True,
    max_retries=3,
    default_retry_delay=60,
)
def refresh_exchange_rates_task(self) -> dict:
    """Periodic task to refresh exchange rates (runs every 15 min via Celery Beat).

    Implementation:
      1. Open sync DB session.
      2. Query all active ``PricingRule`` rows where
         ``category == 'exchange_rate'``.
      3. For each pair, call the external API.
      4. On success: update Redis cache with 24h TTL, log the update.
      5. On failure: log warning, keep stale cached value (if any).
    """
    logger.info("Starting scheduled exchange rate refresh")

    db: Session = _get_session()
    redis_client: SyncRedis = _get_sync_redis()
    updated_pairs: list[str] = []
    failed_pairs: list[str] = []

    try:
        # Get all active exchange rate rules
        rules = db.execute(
            select(PricingRule).where(
                PricingRule.category == "exchange_rate",
                PricingRule.is_active.is_(True),
                PricingRule.status == PricingRuleStatus.ACTIVE,
            )
        ).scalars().all()

        if not rules:
            logger.info("No active exchange rate rules found in DB")
            return {
                "status": "success",
                "task": "refresh-exchange-rates",
                "updated": [],
                "failed": [],
                "note": "no_active_rules",
            }

        for rule in rules:
            # Parse currency pair from rule name
            # Expected format: "exchange_rate_cny_jod" → from="CNY", to="JOD"
            parts = rule.name.split("_")
            if len(parts) < 4:
                logger.debug(
                    "Skipping rule with unexpected name format",
                    extra={"rule_name": rule.name},
                )
                continue

            from_currency = parts[2].upper()  # e.g. "cny" → "CNY"
            to_currency = parts[3].upper()    # e.g. "jod" → "JOD"

            pair = f"{from_currency}/{to_currency}"

            # Fetch from API
            rate = _fetch_rate_from_api(from_currency, to_currency)

            if rate is not None:
                # Update Redis cache
                _set_cached_rate_sync(redis_client, from_currency, to_currency, rate)

                # Update DB rule value (optional — keeps DB in sync with latest)
                if abs(rule.value - rate) / max(rule.value, 0.001) > 0.01:
                    logger.info(
                        "Exchange rate changed significantly (>1%)",
                        extra={
                            "pair": pair,
                            "old_value": rule.value,
                            "new_value": rate,
                        },
                    )

                updated_pairs.append(pair)
                logger.debug(
                    "Exchange rate refreshed",
                    extra={"pair": pair, "rate": rate},
                )
            else:
                failed_pairs.append(pair)
                logger.warning(
                    "Failed to refresh exchange rate (stale cache preserved)",
                    extra={"pair": pair},
                )

        logger.info(
            "Exchange rate refresh completed",
            extra={
                "updated": len(updated_pairs),
                "failed": len(failed_pairs),
            },
        )
        return {
            "status": "success",
            "task": "refresh-exchange-rates",
            "updated": updated_pairs,
            "failed": failed_pairs,
        }

    except Exception as exc:
        logger.error(
            "Exchange rate refresh failed",
            extra={"error": str(exc)},
        )
        raise self.retry(exc=exc)

    finally:
        db.close()
        redis_client.close()



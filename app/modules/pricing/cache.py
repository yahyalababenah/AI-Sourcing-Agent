"""
AI-Sourcing Hub — Pricing Cache

Caches exchange rates and pricing rules in Redis to reduce DB lookups
and external API calls.

Cache Key Scheme:
    exchange_rate:{from_currency}:{to_currency}
    Example: exchange_rate:RMB:USD

TTL Policy:
    Default: 86400s (24 hours) — balances API cost vs. freshness.

Invalidation Triggers:
    1. Celery Beat Scheduled Refresh (every 15 minutes)
    2. Webhook Endpoint (POST /api/v1/webhooks/exchange-rate)
    3. Manual Admin Override (PUT /api/v1/pricing/rules/{id})
    4. Automatic Invalidation on >5% drift
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import asyncio
import json
from decimal import Decimal
from typing import Optional

import httpx
from redis.asyncio import Redis

from app.shared.logging import get_logger
from app.shared.redis_client import cache_get, cache_set, cache_delete, cache_exists

logger = get_logger(__name__)


# Cache key prefixes
EXCHANGE_RATE_CACHE_PREFIX = "pricing:exchange_rate:"
RULES_CACHE_KEY = "pricing:rules:all"
RULES_LIST_CACHE_PREFIX = "pricing:rules:list:"  # keyed by (category, active_only)
ADMIN_STATS_CACHE_KEY = "admin:stats"

# Stampede-prevention lock keys and TTLs
EXCHANGE_RATE_LOCK_PREFIX = "pricing:exchange_rate:lock:"
RULES_CACHE_LOCK_KEY = "pricing:rules:rebuild_lock"
REBUILD_LOCK_TTL = 10  # seconds — max time to hold a rebuild lock

# TTL values
RULES_CACHE_TTL = 3600           # 1 hour
RULES_LIST_CACHE_TTL = 300       # 5 minutes
ADMIN_STATS_CACHE_TTL = 60       # 1 minute
EXCHANGE_RATE_CACHE_TTL = 86400  # 24 hours (per roadmap §3.3)
EXCHANGE_RATE_API_TIMEOUT = 5.0  # seconds — reduced from 10s to fail fast


# ═══════════════════════════════════════════════════════════
# Exchange Rate Cache — Low-Level
# ═══════════════════════════════════════════════════════════

async def get_cached_exchange_rate(
    redis: Redis,
    from_currency: str,
    to_currency: str,
) -> Optional[float]:
    """Get cached exchange rate.

    Args:
        redis: Redis client.
        from_currency: Source currency code.
        to_currency: Target currency code.

    Returns:
        Cached rate or None.
    """
    key = f"{EXCHANGE_RATE_CACHE_PREFIX}{from_currency.upper()}:{to_currency.upper()}"
    value = await cache_get(redis, key)
    if value is not None:
        try:
            return float(value)
        except (TypeError, ValueError):
            logger.warning("Invalid cached exchange rate value", extra={"key": key, "value": value})
            return None
    return None


async def set_cached_exchange_rate(
    redis: Redis,
    from_currency: str,
    to_currency: str,
    rate: float,
    ttl: int = EXCHANGE_RATE_CACHE_TTL,
) -> None:
    """Cache an exchange rate.

    Args:
        redis: Redis client.
        from_currency: Source currency code.
        to_currency: Target currency code.
        rate: Exchange rate value.
        ttl: TTL in seconds (default 24h).
    """
    key = f"{EXCHANGE_RATE_CACHE_PREFIX}{from_currency.upper()}:{to_currency.upper()}"
    await cache_set(redis, key, str(rate), ttl=ttl)
    logger.debug(
        "Exchange rate cached",
        extra={"pair": f"{from_currency}/{to_currency}", "rate": rate, "ttl": ttl},
    )


async def invalidate_exchange_rate(
    redis: Redis,
    from_currency: str,
    to_currency: str,
) -> None:
    """Delete a cached exchange rate key.

    Used by webhook endpoint for live rate pushes, and admin override.

    Args:
        redis: Redis client.
        from_currency: Source currency code.
        to_currency: Target currency code.
    """
    key = f"{EXCHANGE_RATE_CACHE_PREFIX}{from_currency.upper()}:{to_currency.upper()}"
    await cache_delete(redis, key)
    logger.info(
        "Exchange rate cache invalidated",
        extra={"pair": f"{from_currency}/{to_currency}"},
    )


# ═══════════════════════════════════════════════════════════
# Exchange Rate — High-Level (Auto-Fetch on Miss)
# ═══════════════════════════════════════════════════════════

async def _fetch_exchange_rate_from_api(
    from_currency: str,
    to_currency: str,
) -> Optional[float]:
    """Fetch exchange rate from external API (exchangerate-api.com).

    Args:
        from_currency: Source currency code.
        to_currency: Target currency code.

    Returns:
        Rate if API call succeeds, else None.
    """
    from app.config import settings

    if not settings.EXCHANGE_RATE_API_KEY:
        logger.warning(
            "No EXCHANGE_RATE_API_KEY configured; cannot fetch live rate",
            extra={"pair": f"{from_currency}/{to_currency}"},
        )
        return None

    try:
        url = (
            f"https://v6.exchangerate-api.com/v6/{settings.EXCHANGE_RATE_API_KEY}"
            f"/pair/{from_currency.upper()}/{to_currency.upper()}"
        )
        async with httpx.AsyncClient(timeout=EXCHANGE_RATE_API_TIMEOUT) as client:
            response = await client.get(url)

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
                "Exchange rate API returned unsuccessful result",
                extra={"pair": f"{from_currency}/{to_currency}", "api_result": data.get("result")},
            )
            return None

        rate = float(data["conversion_rate"])
        logger.info(
            "Fetched exchange rate from API",
            extra={"pair": f"{from_currency}/{to_currency}", "rate": rate},
        )
        return rate

    except httpx.TimeoutException:
        logger.error(
            "Exchange rate API timed out",
            extra={"pair": f"{from_currency}/{to_currency}"},
        )
        return None
    except (httpx.RequestError, ValueError, KeyError, json.JSONDecodeError) as exc:
        logger.error(
            "Exchange rate API request failed",
            extra={"pair": f"{from_currency}/{to_currency}", "error": str(exc)},
        )
        return None


async def get_exchange_rate(
    redis: Redis,
    from_currency: str,
    to_currency: str,
) -> Optional[float]:
    """Get exchange rate with automatic cache-miss fallback to external API.

    Uses a Redis lock (SET NX) to prevent cache stampede — only one worker
    fetches from the external API when the cache expires; others wait briefly
    and then read the freshly-cached value.

    Implements the strategy from roadmap §3.3:
    1. Check Redis key ``exchange_rate:{from}:{to}``.
    2. If present and TTL > 0, return cached value.
    3. If absent / missed, acquire a rebuild lock.
       - If lock acquired: fetch from API, store in Redis, release lock, return.
       - If lock not acquired: sleep 200 ms and re-read from cache (stampede guard).
    4. If API unreachable, log warning and return None.

    Args:
        redis: Redis client.
        from_currency: Source currency code (e.g. "RMB", "USD").
        to_currency: Target currency code (e.g. "USD", "JOD").

    Returns:
        Exchange rate as float, or None if neither cache nor API available.
    """
    from_upper = from_currency.upper()
    to_upper = to_currency.upper()

    # 1. Check cache first
    cached = await get_cached_exchange_rate(redis, from_upper, to_upper)
    if cached is not None:
        logger.debug(
            "Exchange rate cache hit",
            extra={"pair": f"{from_upper}/{to_upper}", "rate": cached},
        )
        return cached

    # 2. Cache miss — try to acquire a rebuild lock to prevent stampede
    lock_key = f"{EXCHANGE_RATE_LOCK_PREFIX}{from_upper}:{to_upper}"
    acquired = await redis.set(lock_key, "1", nx=True, ex=REBUILD_LOCK_TTL)

    if not acquired:
        # Another worker is already fetching — wait and read from cache
        await asyncio.sleep(0.2)
        result = await get_cached_exchange_rate(redis, from_upper, to_upper)
        if result is not None:
            return result
        # If still None after wait, fall through to fetch below (lock may have expired)

    try:
        # 3. Fetch from external API
        logger.info(
            "Exchange rate cache miss — fetching from API",
            extra={"pair": f"{from_upper}/{to_upper}"},
        )
        rate = await _fetch_exchange_rate_from_api(from_upper, to_upper)

        # 4. Cache the result if we got one
        if rate is not None:
            await set_cached_exchange_rate(redis, from_upper, to_upper, rate)
            return rate

        # API unreachable
        logger.warning(
            "Exchange rate unavailable — cache miss and API unreachable",
            extra={"pair": f"{from_upper}/{to_upper}"},
        )
        return None

    finally:
        if acquired:
            await redis.delete(lock_key)


async def set_exchange_rate(
    redis: Redis,
    from_currency: str,
    to_currency: str,
    rate: float,
    ttl: int = EXCHANGE_RATE_CACHE_TTL,
) -> None:
    """Set exchange rate in cache (used by Celery Beat for proactive refresh).

    Args:
        redis: Redis client.
        from_currency: Source currency code.
        to_currency: Target currency code.
        rate: Exchange rate value.
        ttl: TTL in seconds (default 24h).
    """
    await set_cached_exchange_rate(redis, from_currency, to_currency, rate, ttl=ttl)
    logger.info(
        "Exchange rate set",
        extra={
            "pair": f"{from_currency}/{to_currency}",
            "rate": rate,
            "ttl": ttl,
        },
    )


# ═══════════════════════════════════════════════════════════
# Pricing Rules Cache
# ═══════════════════════════════════════════════════════════

async def get_cached_rules(
    redis: Redis,
) -> Optional[dict[str, float]]:
    """Get all cached pricing rules.

    Args:
        redis: Redis client.

    Returns:
        Dict of rule_name → value, or None.
    """
    value = await cache_get(redis, RULES_CACHE_KEY)
    if value is not None and isinstance(value, dict):
        return {k: float(v) for k, v in value.items()}
    return None


async def set_cached_rules(
    redis: Redis,
    rules: dict[str, float],
) -> None:
    """Cache all pricing rules.

    Args:
        redis: Redis client.
        rules: Dict of rule_name → value.
    """
    await cache_set(redis, RULES_CACHE_KEY, rules, ttl=RULES_CACHE_TTL)


async def invalidate_rules_cache(redis: Redis) -> None:
    """Invalidate the pricing rules cache (calculation dict + all list variants)."""
    await cache_delete(redis, RULES_CACHE_KEY)
    # Delete all list-cache variants via pattern scan
    async for key in redis.scan_iter(f"{RULES_LIST_CACHE_PREFIX}*"):
        await redis.delete(key)
    logger.info("Pricing rules cache invalidated")


# ═══════════════════════════════════════════════════════════
# Pricing Rules List Cache  (full API response objects)
# ═══════════════════════════════════════════════════════════

def _rules_list_key(category: str | None, active_only: bool) -> str:
    return f"{RULES_LIST_CACHE_PREFIX}{category or 'all'}:{int(active_only)}"


async def get_cached_rules_list(
    redis: Redis,
    category: str | None,
    active_only: bool,
) -> Optional[dict]:
    return await cache_get(redis, _rules_list_key(category, active_only))


async def set_cached_rules_list(
    redis: Redis,
    category: str | None,
    active_only: bool,
    data: dict,
) -> None:
    await cache_set(redis, _rules_list_key(category, active_only), data, ttl=RULES_LIST_CACHE_TTL)


# ═══════════════════════════════════════════════════════════
# Admin Stats Cache
# ═══════════════════════════════════════════════════════════

async def get_cached_admin_stats(redis: Redis) -> Optional[dict]:
    return await cache_get(redis, ADMIN_STATS_CACHE_KEY)


async def set_cached_admin_stats(redis: Redis, data: dict) -> None:
    await cache_set(redis, ADMIN_STATS_CACHE_KEY, data, ttl=ADMIN_STATS_CACHE_TTL)


async def invalidate_admin_stats_cache(redis: Redis) -> None:
    await cache_delete(redis, ADMIN_STATS_CACHE_KEY)

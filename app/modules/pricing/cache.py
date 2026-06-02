"""
AI-Sourcing Hub — Pricing Cache

Caches exchange rates and pricing rules in Redis to reduce DB lookups.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import json
from typing import Optional

from redis.asyncio import Redis

from app.shared.logging import get_logger
from app.shared.redis_client import cache_get, cache_set, cache_delete

logger = get_logger(__name__)

# Cache key prefixes
EXCHANGE_RATE_CACHE_PREFIX = "pricing:exchange_rate:"
RULES_CACHE_KEY = "pricing:rules:all"
RULES_CACHE_TTL = 3600  # 1 hour
EXCHANGE_RATE_CACHE_TTL = 900  # 15 minutes


# ═══════════════════════════════════════════════════════════
# Exchange Rate Cache
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
        return float(value)
    return None


async def set_cached_exchange_rate(
    redis: Redis,
    from_currency: str,
    to_currency: str,
    rate: float,
) -> None:
    """Cache an exchange rate.

    Args:
        redis: Redis client.
        from_currency: Source currency code.
        to_currency: Target currency code.
        rate: Exchange rate value.
    """
    key = f"{EXCHANGE_RATE_CACHE_PREFIX}{from_currency.upper()}:{to_currency.upper()}"
    await cache_set(redis, key, str(rate), ttl=EXCHANGE_RATE_CACHE_TTL)


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
    """Invalidate the pricing rules cache.

    Called after a rule is created, updated, or deleted.
    """
    await cache_delete(redis, RULES_CACHE_KEY)
    logger.info("Pricing rules cache invalidated")

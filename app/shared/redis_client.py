"""
AI-Sourcing Hub — Async Redis Client

Provides:
- Redis async connection pool
- FastAPI dependency for session injection
- Helper functions: cache_get, cache_set, cache_delete with JSON serialization
"""

import json
from collections.abc import AsyncGenerator
from typing import Any, Optional

import redis.asyncio as aioredis
from redis.asyncio import Redis

from app.config import settings

# ---- Redis Connection Pool ----
redis_pool: aioredis.ConnectionPool | None = None


async def init_redis_pool() -> None:
    """Initialize the Redis connection pool."""
    global redis_pool
    redis_pool = aioredis.ConnectionPool.from_url(
        settings.redis_url,
        max_connections=20,
        decode_responses=True,
    )


async def close_redis_pool() -> None:
    """Close the Redis connection pool."""
    global redis_pool
    if redis_pool:
        await redis_pool.disconnect()
        redis_pool = None


async def get_redis() -> Redis:
    """Get a Redis connection from the pool."""
    if redis_pool is None:
        await init_redis_pool()
    return Redis(connection_pool=redis_pool)


# ---- FastAPI Dependency ----
async def get_redis_client() -> AsyncGenerator[Redis, None]:
    """FastAPI dependency that yields a Redis client.

    Usage:
        @router.get("/items")
        async def get_items(redis: Redis = Depends(get_redis_client)):
            ...
    """
    redis = await get_redis()
    try:
        yield redis
    finally:
        await redis.close()


# ---- Cache Helpers ----

async def cache_get(redis: Redis, key: str) -> Optional[Any]:
    """Get a JSON-deserialized value from cache.

    Args:
        redis: Redis client instance.
        key: Cache key to retrieve.

    Returns:
        Deserialized value if found, None otherwise.
    """
    value = await redis.get(key)
    if value is None:
        return None
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return value


async def cache_set(
    redis: Redis, key: str, value: Any, ttl: int = 3600
) -> bool:
    """Set a JSON-serialized value in cache with TTL.

    Args:
        redis: Redis client instance.
        key: Cache key to set.
        value: Value to cache (will be JSON-serialized).
        ttl: Time-to-live in seconds (default: 1 hour).

    Returns:
        True if successful.
    """
    serialized = json.dumps(value, default=str)
    return await redis.setex(key, ttl, serialized)


async def cache_delete(redis: Redis, key: str) -> bool:
    """Delete a cache key.

    Args:
        redis: Redis client instance.
        key: Cache key to delete.

    Returns:
        True if key was deleted, False if not found.
    """
    return await redis.delete(key) > 0


async def cache_exists(redis: Redis, key: str) -> bool:
    """Check if a cache key exists.

    Args:
        redis: Redis client instance.
        key: Cache key to check.

    Returns:
        True if key exists.
    """
    return await redis.exists(key) > 0

"""
AI-Sourcing Hub — Redis-Backed Rate Limiter

Provides:
- Sliding-window rate limiting via Redis sorted sets
- Per-user (authenticated) and per-IP (unauthenticated) limits
- Scope-based limits: general (100 req/min) vs upload (10 req/min)
- FastAPI middleware that sets X-RateLimit-* headers
- Returns 429 with Retry-After when exceeded

Usage:
    from app.shared.rate_limiter import RateLimitMiddleware

    app.add_middleware(RateLimitMiddleware)
"""

import asyncio
import ipaddress
import re
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any, Optional

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.config import settings
from app.shared.logging import get_logger

logger = get_logger(__name__)

# ---- Rate Limit Parsing ----

# Compiled regex for "N/window" format, e.g. "100/minute", "10/minute"
_RATE_PATTERN = re.compile(r"^(\d+)/(minute|second|hour)$")
_WINDOW_MAP = {
    "second": 1,
    "minute": 60,
    "hour": 3600,
}


def _parse_rate_limit(rate_str: str) -> tuple[int, int]:
    """Parse a rate limit string into (max_requests, window_seconds).

    Args:
        rate_str: e.g. "100/minute", "10/minute", "5/second"

    Returns:
        Tuple of (max_requests, window_seconds).

    Raises:
        ValueError: If the string format is invalid.
    """
    match = _RATE_PATTERN.match(rate_str.strip().lower())
    if not match:
        raise ValueError(
            f"Invalid rate limit format: '{rate_str}'. "
            f"Expected format: 'N/(minute|second|hour)', e.g. '100/minute'."
        )
    max_requests = int(match.group(1))
    window_unit = match.group(2)
    window_seconds = _WINDOW_MAP[window_unit]
    return max_requests, window_seconds


# ---- Scope Definitions ----

# Auth paths get the strictest limit (brute-force protection)
_AUTH_PATHS = {"/api/v1/auth/login", "/api/v1/auth/register"}

# Upload paths get a stricter limit
_UPLOAD_PATHS = {"/api/v1/documents/upload", "/api/v1/documents"}

# Health check and docs paths are excluded from rate limiting
_EXCLUDED_PATHS = {"/health", "/metrics", "/api/docs", "/api/redoc", "/api/openapi.json"}


def _get_rate_limit_for_path(path: str) -> tuple[int, int]:
    """Determine which rate limit applies to a given request path.

    Priority: auth > upload > general.

    Args:
        path: The request URL path.

    Returns:
        Tuple of (max_requests, window_seconds).
    """
    for auth_path in _AUTH_PATHS:
        if path.startswith(auth_path):
            return _parse_rate_limit(settings.RATE_LIMIT_AUTH)
    for upload_path in _UPLOAD_PATHS:
        if path.startswith(upload_path):
            return _parse_rate_limit(settings.RATE_LIMIT_UPLOAD)
    return _parse_rate_limit(settings.RATE_LIMIT_GENERAL)


def _is_trusted_proxy(ip: str) -> bool:
    """Return True if ip falls within one of the configured trusted proxy CIDRs.

    Prevents X-Forwarded-For spoofing: we only honour the header when the
    direct connection comes from a known proxy (Nginx in Docker Compose).
    """
    try:
        addr = ipaddress.ip_address(ip)
        for cidr in settings.TRUSTED_PROXY_CIDRS:
            if addr in ipaddress.ip_network(cidr, strict=False):
                return True
    except ValueError:
        pass
    return False


def _get_client_identifier(request: Request) -> tuple[str, str]:
    """Extract a stable client identifier from the request.

    Priority:
        1. Authenticated user_id (from ``request.state.user``)
        2. X-Forwarded-For — only if the direct connection is from a trusted proxy
        3. Remote IP (``request.client.host``)

    X-Forwarded-For is validated against TRUSTED_PROXY_CIDRS so an attacker
    cannot spoof their IP by setting the header from an untrusted connection.

    Returns:
        Tuple of (identifier_type, identifier_value).
        identifier_type is "user" or "ip".
    """
    # Check if request.state.user exists (set by auth middleware)
    user = getattr(request.state, "user", None)
    if user is not None:
        user_id = getattr(user, "id", None) or str(user)
        return "user", str(user_id)

    # Only trust X-Forwarded-For when the direct connection is from a trusted proxy
    direct_ip = request.client.host if request.client else None
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded and direct_ip and _is_trusted_proxy(direct_ip):
        ip = forwarded.split(",")[0].strip()
    elif direct_ip:
        ip = direct_ip
    else:
        ip = "unknown"
    return "ip", ip


def _build_redis_key(scope: str, id_type: str, identifier: str) -> str:
    """Build a Redis key for rate limit tracking.

    Args:
        scope: "general" or "upload".
        id_type: "user" or "ip".
        identifier: The user_id or IP address.

    Returns:
        Redis key string.
    """
    return f"ratelimit:{scope}:{id_type}:{identifier}"


# ---- Rate Limit Middleware ----

class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for Redis-backed sliding window rate limiting.

    Applies per-user (authenticated) and per-IP (unauthenticated) limits
    with different thresholds for general vs upload endpoints.
    """

    def __init__(self, app: ASGIApp, redis_client: Optional[Any] = None) -> None:
        """
        Args:
            app: The ASGI application.
            redis_client: Optional pre-configured Redis client. If not provided,
                          one will be obtained lazily.
        """
        super().__init__(app)
        self._redis = redis_client
        self._redis_lock = asyncio.Lock()

    async def _get_redis(self) -> Any:
        """Get or create a Redis client for rate limiting."""
        if self._redis is None:
            async with self._redis_lock:
                if self._redis is None:  # Double-check
                    from app.shared.redis_client import get_redis

                    self._redis = await get_redis()
        return self._redis

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Process an incoming request and apply rate limiting.

        Steps:
            1. Skip excluded paths (health, metrics, docs).
            2. Determine scope (general vs upload) from request path.
            3. Extract client identifier (user_id or IP).
            4. Check sliding window in Redis.
            5. If over limit, return 429 with Retry-After.
            6. Otherwise, add current request to window and proceed.
            7. Inject X-RateLimit-* headers into the response.
        """
        path = request.url.path

        # ---- Skip excluded paths ----
        if path in _EXCLUDED_PATHS or path.startswith("/static"):
            return await call_next(request)

        # ---- Skip OPTIONS (CORS preflight) ----
        if request.method == "OPTIONS":
            return await call_next(request)

        # ---- Determine scope and limits ----
        max_requests, window_seconds = _get_rate_limit_for_path(path)

        # Determine scope name for Redis key
        if any(path.startswith(p) for p in _AUTH_PATHS):
            scope = "auth"
        elif any(path.startswith(p) for p in _UPLOAD_PATHS):
            scope = "upload"
        else:
            scope = "general"

        # ---- Extract client identifier ----
        id_type, identifier = _get_client_identifier(request)
        redis_key = _build_redis_key(scope, id_type, identifier)

        # ---- Sliding window check ----
        redis = await self._get_redis()
        now = time.time()
        window_start = now - window_seconds
        request_id = f"{now}:{uuid.uuid4().hex[:8]}"

        try:
            # Use a Redis pipeline for atomicity
            async with redis.pipeline(transaction=True) as pipe:
                # Remove entries outside the window
                await pipe.zremrangebyscore(redis_key, 0, window_start)
                # Count remaining entries
                await pipe.zcard(redis_key)
                results = await pipe.execute()
                # results[0] = zremrangebyscore result, results[1] = zcard result
                current_count = results[1] if len(results) > 1 else 0

            if current_count >= max_requests:
                # Calculate when the oldest entry expires
                reset_time = int(window_start + window_seconds)
                retry_after = max(1, int(reset_time - now))

                logger.warning(
                    "Rate limit exceeded",
                    extra={
                        "scope": scope,
                        "id_type": id_type,
                        "identifier": identifier,
                        "limit": max_requests,
                        "window_seconds": window_seconds,
                        "current_count": current_count,
                        "path": path,
                        "method": request.method,
                    },
                )

                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Too Many Requests",
                        "retry_after_seconds": retry_after,
                        "scope": scope,
                        "limit": max_requests,
                        "window_seconds": window_seconds,
                    },
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(max_requests),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(reset_time),
                    },
                )

            # ---- Add current request to the window ----
            await redis.zadd(redis_key, {request_id: now})
            await redis.expire(redis_key, window_seconds * 2)

            remaining = max_requests - current_count - 1
            reset_time = int(window_start + window_seconds)

            # ---- Proceed with the request ----
            response = await call_next(request)

            # ---- Inject rate limit headers ----
            response.headers["X-RateLimit-Limit"] = str(max_requests)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            response.headers["X-RateLimit-Reset"] = str(reset_time)

            return response

        except Exception as exc:
            # If Redis is down, allow the request through (fail open)
            logger.error(
                "Rate limiter Redis error — allowing request",
                extra={"error": str(exc), "path": path, "method": request.method},
            )
            return await call_next(request)

"""
Tests for the Redis-backed Rate Limiter.

Covers:
    - Rate limit string parsing
    - Client identifier extraction
    - Redis key construction
    - Rate limit middleware logic (fail-open on Redis errors)
    - Excluded paths bypass
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.shared.rate_limiter import (
    _parse_rate_limit,
    _build_redis_key,
    _get_rate_limit_for_path,
    RateLimitMiddleware,
)

# ═══════════════════════════════════════════════════════════
# Unit Tests: Rate Limit Parsing
# ═══════════════════════════════════════════════════════════


class TestParseRateLimit:
    """Unit tests for ``_parse_rate_limit()``."""

    def test_parses_per_minute(self):
        """Should parse '100/minute' correctly."""
        max_req, window = _parse_rate_limit("100/minute")
        assert max_req == 100
        assert window == 60

    def test_parses_per_second(self):
        """Should parse '5/second' correctly."""
        max_req, window = _parse_rate_limit("5/second")
        assert max_req == 5
        assert window == 1

    def test_parses_per_hour(self):
        """Should parse '1000/hour' correctly."""
        max_req, window = _parse_rate_limit("1000/hour")
        assert max_req == 1000
        assert window == 3600

    def test_rejects_invalid_format(self):
        """Should raise ValueError for invalid format."""
        with pytest.raises(ValueError):
            _parse_rate_limit("invalid")
        with pytest.raises(ValueError):
            _parse_rate_limit("100/day")
        with pytest.raises(ValueError):
            _parse_rate_limit("")


# ═══════════════════════════════════════════════════════════
# Unit Tests: Rate Limit Path Resolution
# ═══════════════════════════════════════════════════════════


class TestGetRateLimitForPath:
    """Tests for ``_get_rate_limit_for_path()``."""

    @patch("app.shared.rate_limiter.settings")
    def test_general_endpoint(self, mock_settings):
        """General endpoints should use RATE_LIMIT_GENERAL (100/minute)."""
        mock_settings.RATE_LIMIT_GENERAL = "100/minute"
        mock_settings.RATE_LIMIT_UPLOAD = "10/minute"
        max_req, window = _get_rate_limit_for_path("/api/v1/quotes")
        assert max_req == 100
        assert window == 60

    @patch("app.shared.rate_limiter.settings")
    def test_upload_endpoint(self, mock_settings):
        """Upload endpoints should use RATE_LIMIT_UPLOAD (10/minute)."""
        mock_settings.RATE_LIMIT_GENERAL = "100/minute"
        mock_settings.RATE_LIMIT_UPLOAD = "10/minute"
        max_req, window = _get_rate_limit_for_path("/api/v1/documents/upload")
        assert max_req == 10
        assert window == 60

    @patch("app.shared.rate_limiter.settings")
    def test_documents_prefix(self, mock_settings):
        """Paths starting with /api/v1/documents should use upload limit."""
        mock_settings.RATE_LIMIT_GENERAL = "100/minute"
        mock_settings.RATE_LIMIT_UPLOAD = "10/minute"
        max_req, window = _get_rate_limit_for_path("/api/v1/documents")
        assert max_req == 10
        assert window == 60


# ═══════════════════════════════════════════════════════════
# Unit Tests: Redis Key Construction
# ═══════════════════════════════════════════════════════════


class TestBuildRedisKey:
    """Tests for ``_build_redis_key()``."""

    def test_user_key(self):
        """Should build key for authenticated user."""
        key = _build_redis_key("general", "user", "user-abc-123")
        assert key == "ratelimit:general:user:user-abc-123"

    def test_ip_key(self):
        """Should build key for IP-based limiting."""
        key = _build_redis_key("upload", "ip", "192.168.1.1")
        assert key == "ratelimit:upload:ip:192.168.1.1"


# ═══════════════════════════════════════════════════════════
# Tests: Middleware (Fail-Open on Redis Error)
# ═══════════════════════════════════════════════════════════


class TestRateLimitMiddleware:
    """Tests for RateLimitMiddleware behavior."""

    @pytest.mark.asyncio
    async def test_bypasses_excluded_paths(self):
        """Health and metrics endpoints should bypass rate limiting."""
        app = FastAPI()

        @app.get("/health")
        async def health():
            return {"status": "ok"}

        app.add_middleware(RateLimitMiddleware)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/health")
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_bypasses_options(self):
        """OPTIONS preflight requests should bypass rate limiting."""
        app = FastAPI()

        @app.options("/test")
        async def options():
            return {}

        app.add_middleware(RateLimitMiddleware)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.options("/test")
            # Should not crash even without Redis
            assert response.status_code in (200, 405)

    @pytest.mark.asyncio
    async def test_fails_open_on_redis_error(self):
        """Should allow request through if Redis is unavailable (fail-open)."""
        app = FastAPI()

        @app.get("/api/v1/test")
        async def test_endpoint():
            return {"message": "ok"}

        app.add_middleware(RateLimitMiddleware)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Without Redis running, the middleware should log an error
            # and allow the request through (fail-open behavior)
            response = await client.get("/api/v1/test")
            assert response.status_code == 200
            # Rate limit headers should NOT be present on fail-open
            assert "X-RateLimit-Limit" not in response.headers

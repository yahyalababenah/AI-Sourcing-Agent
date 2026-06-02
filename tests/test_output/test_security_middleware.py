"""
Tests for the Security & Audit Middleware.

Covers:
    - SecurityHeadersMiddleware: All headers present in responses
    - SecurityHeadersMiddleware: HSTS varies by environment
    - AuditMiddleware: POST/PUT/DELETE requests are logged
    - AuditMiddleware: GET requests are not logged
    - AuditMiddleware: Sensitive fields are redacted
"""

import logging
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.shared.security_middleware import (
    SecurityHeadersMiddleware,
    AuditMiddleware,
    _sanitize_body,
    _get_security_headers,
)

# ═══════════════════════════════════════════════════════════
# Unit Tests: Security Headers
# ═══════════════════════════════════════════════════════════


class TestGetSecurityHeaders:
    """Tests for ``_get_security_headers()``."""

    def test_includes_all_required_headers(self):
        """Should include all required security headers."""
        headers = _get_security_headers()
        assert "X-Content-Type-Options" in headers
        assert headers["X-Content-Type-Options"] == "nosniff"
        assert "X-Frame-Options" in headers
        assert headers["X-Frame-Options"] == "DENY"
        assert "X-XSS-Protection" in headers
        assert "Referrer-Policy" in headers
        assert "Permissions-Policy" in headers
        assert "Content-Security-Policy" in headers
        assert "Strict-Transport-Security" in headers

    @patch("app.shared.security_middleware.settings.ENVIRONMENT", "production")
    def test_hsts_long_in_production(self):
        """In production, HSTS should be 1 year with preload."""
        headers = _get_security_headers()
        hsts = headers["Strict-Transport-Security"]
        assert "max-age=31536000" in hsts
        assert "includeSubDomains" in hsts
        assert "preload" in hsts

    @patch("app.shared.security_middleware.settings.ENVIRONMENT", "development")
    def test_hsts_short_in_development(self):
        """In development, HSTS should be shorter (1 day)."""
        headers = _get_security_headers()
        hsts = headers["Strict-Transport-Security"]
        assert "max-age=86400" in hsts
        assert "includeSubDomains" in hsts


# ═══════════════════════════════════════════════════════════
# Unit Tests: Body Sanitization
# ═══════════════════════════════════════════════════════════


class TestSanitizeBody:
    """Tests for ``_sanitize_body()``."""

    def test_redacts_sensitive_fields(self):
        """Should replace sensitive field values with '[REDACTED]'."""
        body = {
            "email": "user@example.com",
            "password": "secret123",
            "full_name": "Test User",
            "access_token": "eyJ...",
        }
        sanitized = _sanitize_body(body)
        assert sanitized["email"] == "user@example.com"
        assert sanitized["password"] == "[REDACTED]"
        assert sanitized["full_name"] == "Test User"
        assert sanitized["access_token"] == "[REDACTED]"

    def test_nested_redaction(self):
        """Should recursively redact nested sensitive fields."""
        body = {
            "user": {
                "password": "hunter2",
                "profile": {"name": "Alice", "token": "abc123"},
            }
        }
        sanitized = _sanitize_body(body)
        assert sanitized["user"]["password"] == "[REDACTED]"
        assert sanitized["user"]["profile"]["name"] == "Alice"
        assert sanitized["user"]["profile"]["token"] == "[REDACTED]"

    def test_list_handling(self):
        """Should sanitize each item in a list."""
        body = [
            {"name": "Item 1", "secret": "s1"},
            {"name": "Item 2", "secret": "s2"},
        ]
        sanitized = _sanitize_body(body)
        assert sanitized[0]["secret"] == "[REDACTED]"
        assert sanitized[1]["secret"] == "[REDACTED]"

    def test_non_dict_passthrough(self):
        """Should return scalar/primitive values unchanged."""
        assert _sanitize_body("hello") == "hello"
        assert _sanitize_body(42) == 42
        assert _sanitize_body(None) is None


# ═══════════════════════════════════════════════════════════
# Integration Tests: Security Headers Middleware
# ═══════════════════════════════════════════════════════════


class TestSecurityHeadersMiddleware:
    """Tests that SecurityHeadersMiddleware adds headers to responses."""

    @pytest.fixture
    def app(self):
        application = FastAPI()

        @application.get("/test")
        async def test_endpoint():
            return {"message": "ok"}

        application.add_middleware(SecurityHeadersMiddleware)
        return application

    @pytest.mark.asyncio
    async def test_adds_security_headers(self, app):
        """Response should include all security headers."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/test")
            assert response.status_code == 200
            assert response.headers.get("X-Content-Type-Options") == "nosniff"
            assert response.headers.get("X-Frame-Options") == "DENY"
            assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
            assert "Strict-Transport-Security" in response.headers


# ═══════════════════════════════════════════════════════════
# Integration Tests: Audit Middleware
# ═══════════════════════════════════════════════════════════


class TestAuditMiddleware:
    """Tests that AuditMiddleware logs state-changing requests."""

    @pytest.fixture
    def app(self):
        application = FastAPI()

        @application.post("/api/v1/test")
        async def create_item():
            return {"id": 1, "name": "test"}

        @application.put("/api/v1/test/1")
        async def update_item():
            return {"id": 1, "updated": True}

        @application.delete("/api/v1/test/1")
        async def delete_item():
            return {"message": "deleted"}

        @application.get("/api/v1/test")
        async def list_items():
            return {"items": []}

        application.add_middleware(AuditMiddleware)
        return application

    @pytest.mark.asyncio
    async def test_logs_post_request(self, app, caplog):
        """POST requests should produce audit log entries."""
        caplog.set_level(logging.INFO)
        transport = ASGITransport(app=app)

        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/api/v1/test", json={"name": "new"})

        assert response.status_code == 200
        # Check that an audit log entry was created
        audit_logs = [r for r in caplog.records if r.msg.startswith("Audit:")]
        assert len(audit_logs) >= 1
        # Use getMessage() to get the fully formatted log string
        # (r.msg is the format template, r.args holds the interpolated values)
        assert "POST" in audit_logs[0].getMessage()

    @pytest.mark.asyncio
    async def test_skips_get_requests(self, app, caplog):
        """GET requests should NOT produce audit log entries."""
        caplog.set_level(logging.INFO)
        transport = ASGITransport(app=app)

        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/test")

        assert response.status_code == 200
        audit_logs = [r for r in caplog.records if r.msg.startswith("Audit:")]
        # GET should not be audited
        get_logs = [r for r in audit_logs if "GET" in r.msg]
        assert len(get_logs) == 0

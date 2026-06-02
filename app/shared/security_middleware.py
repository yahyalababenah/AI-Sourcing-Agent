"""
AI-Sourcing Hub — Security & Audit Middleware

Provides:
1. SecurityHeadersMiddleware: Helmet-style security headers
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - Content-Security-Policy
   - Strict-Transport-Security (in production)
   - Referrer-Policy
   - Permissions-Policy
   - X-XSS-Protection: 0 (deprecated but harmless)

2. AuditMiddleware: Log all POST/PUT/DELETE requests with
   - user_id, endpoint, method, request body (sanitized),
   - response status, latency, IP address.

Usage:
    from app.shared.security_middleware import (
        SecurityHeadersMiddleware,
        AuditMiddleware,
    )

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(AuditMiddleware)
"""

import json
import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.config import settings
from app.shared.logging import get_logger

logger = get_logger(__name__)

# ---- Sensitive Fields to Redact in Audit Logs ----
_SENSITIVE_FIELDS = {
    "password",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "api_key",
    "authorization",
    "jwt",
    "credit_card",
    "ssn",
    "passport",
}

# ---- Paths to Exclude from Audit Logging ----
_AUDIT_EXCLUDED_PATHS = {
    "/health",
    "/metrics",
    "/api/docs",
    "/api/redoc",
    "/api/openapi.json",
}

# ---- Security Headers ----

_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "0",  # Deprecated; browser ignores but safe to include
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": (
        "camera=(), microphone=(), geolocation=(), "
        "payment=(), usb=(), magnetometer=(), "
        "accelerometer=(), gyroscope=()"
    ),
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "form-action 'self'"
    ),
}


def _get_security_headers() -> dict[str, str]:
    """Get the base set of security headers.

    In production, also adds Strict-Transport-Security (HSTS).

    Returns:
        Dictionary of header name → header value.
    """
    headers = dict(_SECURITY_HEADERS)

    if settings.ENVIRONMENT == "production":
        # HSTS: 1 year, include subdomains, preload
        headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
    else:
        # Shorter HSTS for non-production
        headers["Strict-Transport-Security"] = (
            "max-age=86400; includeSubDomains"
        )

    return headers


# ---- Body Sanitization ----

def _sanitize_body(body: Any) -> Any:
    """Recursively redact sensitive fields from a request body for audit logging.

    Args:
        body: The request body (parsed JSON dict, list, or scalar).

    Returns:
            Sanitized body with sensitive field values replaced by "[REDACTED]".
        """
    if isinstance(body, dict):
        return {
            k: "[REDACTED]" if k.lower() in _SENSITIVE_FIELDS
            else _sanitize_body(v)
            for k, v in body.items()
        }
    if isinstance(body, list):
        return [_sanitize_body(item) for item in body]
    return body


# ---- Security Headers Middleware ----

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware that injects Helmet-style security headers into every response.

    Headers added:
        - X-Content-Type-Options: nosniff
        - X-Frame-Options: DENY
        - Content-Security-Policy
        - Strict-Transport-Security (HSTS)
        - Referrer-Policy
        - Permissions-Policy
        - X-XSS-Protection: 0
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self._headers = _get_security_headers()

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Add security headers to every response."""
        response = await call_next(request)

        for header_name, header_value in self._headers.items():
            response.headers[header_name] = header_value

        return response


# ---- Audit Logging Middleware ----

class AuditMiddleware(BaseHTTPMiddleware):
    """Middleware that logs all state-changing requests (POST/PUT/DELETE).

    Logs:
        - timestamp, user_id (if authenticated), IP address
        - HTTP method, endpoint path
        - Request body (sensitive fields redacted)
        - Response status code
        - Latency in milliseconds

    Excluded paths: /health, /metrics, /docs, /redoc, /openapi.json
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Log state-changing requests with context."""
        path = request.url.path
        method = request.method

        # ---- Skip excluded paths and read-only methods ----
        if path in _AUDIT_EXCLUDED_PATHS or method in ("GET", "HEAD", "OPTIONS"):
            return await call_next(request)

        # ---- Extract user identity ----
        user_id: Optional[str] = None
        user = getattr(request.state, "user", None)
        if user is not None:
            user_id = str(getattr(user, "id", ""))

        # ---- Extract IP ----
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
        elif request.client is not None:
            ip = request.client.host
        else:
            ip = "unknown"

        # ---- Extract and sanitize body ----
        body_data: Any = None
        content_type = request.headers.get("content-type", "")

        if "json" in content_type:
            try:
                # Read body
                body_bytes = await request.body()
                if body_bytes:
                    body_raw = json.loads(body_bytes)
                    body_data = _sanitize_body(body_raw)
            except (json.JSONDecodeError, UnicodeDecodeError):
                body_data = {"_raw": "[unparseable]"}

        start_time = time.monotonic()

        # ---- Process request ----
        try:
            response = await call_next(request)
            latency_ms = (time.monotonic() - start_time) * 1000

            # ---- Log audit entry ----
            logger.info(
                "Audit: %s %s → %d (%.1fms)",
                method,
                path,
                response.status_code,
                latency_ms,
                extra={
                    "audit": True,
                    "user_id": user_id or "anonymous",
                    "method": method,
                    "endpoint": path,
                    "ip": ip,
                    "status_code": response.status_code,
                    "latency_ms": round(latency_ms, 1),
                    "body": body_data,
                },
            )

            return response

        except Exception as exc:
            latency_ms = (time.monotonic() - start_time) * 1000

            logger.error(
                "Audit: %s %s → EXCEPTION (%.1fms): %s",
                method,
                path,
                latency_ms,
                str(exc),
                extra={
                    "audit": True,
                    "user_id": user_id or "anonymous",
                    "method": method,
                    "endpoint": path,
                    "ip": ip,
                    "latency_ms": round(latency_ms, 1),
                    "body": body_data,
                    "error": str(exc),
                },
            )

            raise

"""
AI-Sourcing Hub — FastAPI Application Factory

Architecture: Modular Monolith
All module routers mounted under /api/v1/ with domain prefixes.

Startup (lifespan):
    1. Setup structured JSON logging
    2. Initialize DB connection pool
    3. Initialize Redis connection pool
    4. Ensure MinIO storage buckets exist
    5. Initialize Sentry (if DSN configured)

Shutdown:
    1. Dispose DB engine connections
    2. Close Redis pool
"""

from contextlib import asynccontextmanager
from typing import AsyncIterator

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.redis import RedisIntegration

from app.config import settings
from app.shared.database import engine
from app.shared.error_handlers import register_error_handlers
from app.shared.logging import setup_logging
from app.shared.redis_client import close_redis_pool, init_redis_pool
from app.shared.storage import ensure_bucket

# ---- Module Routers (imported here to avoid circular imports) ----
from app.modules.auth.router import router as auth_router
from app.modules.catalog.router import router as catalog_router
from app.modules.documents.router import router as documents_router
from app.modules.intake.router import router as intake_router
from app.modules.monitoring.router import router as monitoring_router
from app.modules.output.router import router as output_router
from app.modules.chat.router import router as chat_router
from app.modules.pricing.router import router as pricing_router
from app.shared.metrics import (
    PrometheusMiddleware,
    register_metrics_endpoint,
)
from app.shared.rate_limiter import RateLimitMiddleware
from app.shared.security_middleware import (
    AuditMiddleware,
    SecurityHeadersMiddleware,
)


# ---- Lifespan ----
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: startup tasks and shutdown cleanup."""
    # ---- Startup ----
    setup_logging()

    # Initialize Sentry if configured
    if settings.sentry_enabled:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.25,
            profiles_sample_rate=0.10,
            integrations=[
                FastApiIntegration(transaction_style="url"),
                CeleryIntegration(),
                RedisIntegration(),
            ],
            before_send=_sanitize_sentry_event,
        )

    # Initialize connection pools
    await init_redis_pool()

    # Ensure storage buckets exist
    await ensure_bucket(settings.STORAGE_BUCKET_DOCUMENTS)
    await ensure_bucket(settings.STORAGE_BUCKET_QUOTES)

    # In development, run migrations at startup
    if settings.ENVIRONMENT == "development":
        pass  # Alembic migrations are run manually or via CI/CD

    yield

    # ---- Shutdown ----
    await engine.dispose()
    await close_redis_pool()


def _sanitize_sentry_event(event: dict, hint: dict) -> dict | None:
    """Remove PII before sending events to Sentry."""
    if "request" in event and "headers" in event["request"]:
        event["request"]["headers"].pop("Authorization", None)
    if "extra" in event:
        event["extra"].pop("password", None)
        event["extra"].pop("token", None)
        event["extra"].pop("access_token", None)
        event["extra"].pop("refresh_token", None)
    return event


# ---- Application Factory ----
def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="AI-Sourcing Hub API",
        description="B2B Sourcing Automation Platform — bridging China and MENA markets",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        terms_of_service="https://aisourcing.example.com/terms",
        contact={
            "name": "AI-Sourcing Hub Team",
            "url": "https://aisourcing.example.com",
            "email": "support@aisourcing.example.com",
        },
        license_info={
            "name": "Proprietary",
        },
    )

    # ---- Middleware Stack (order matters) ----
    # Outermost: TrustedHost → CORS → SecurityHeaders → RateLimit → Prometheus → Audit (innermost)
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS,
    )
    app.add_middleware(
        CORSMiddleware,
        **settings.cors_config,
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(PrometheusMiddleware)
    app.add_middleware(AuditMiddleware)

    # ---- Global Error Handlers ----
    register_error_handlers(app)

    # ---- Mount Module Routers ----
    app.include_router(
        auth_router,
        prefix="/api/v1/auth",
        tags=["Authentication"],
    )
    app.include_router(
        intake_router,
        prefix="/api/v1/intake",
        tags=["Intake"],
    )
    app.include_router(
        documents_router,
        prefix="/api/v1/documents",
        tags=["Documents"],
    )
    app.include_router(
        pricing_router,
        prefix="/api/v1/pricing",
        tags=["Pricing"],
    )
    app.include_router(
        output_router,
        prefix="/api/v1/quotes",
        tags=["Quotations"],
    )
    app.include_router(
        catalog_router,
        prefix="/api/v1/catalog",
        tags=["Catalog"],
    )
    app.include_router(
        monitoring_router,
        prefix="/api/v1/admin",
        tags=["Admin"],
    )
    app.include_router(
        chat_router,
        prefix="/api/v1/chat",
        tags=["Chat"],
    )

    # ---- Health Check ----
    @app.get(
        "/health",
        tags=["System"],
        summary="Health check endpoint",
        description="Verifies API, database, and Redis connectivity",
    )
    async def health_check(request: Request) -> JSONResponse:
        """Kubernetes/Docker health check.

        Returns:
            200 OK if all services are healthy.
            503 if any critical service is down.
        """
        # Check DB connectivity
        db_healthy = False
        try:
            from sqlalchemy import text
            from app.shared.database import async_session_factory

            async with async_session_factory() as session:
                await session.execute(text("SELECT 1"))
                db_healthy = True
        except Exception:
            db_healthy = False

        # Check Redis connectivity
        redis_healthy = False
        try:
            from app.shared.redis_client import get_redis

            redis = await get_redis()
            await redis.ping()
            redis_healthy = True
        except Exception:
            redis_healthy = False

        overall_healthy = db_healthy and redis_healthy
        status_code = 200 if overall_healthy else 503

        return JSONResponse(
            status_code=status_code,
            content={
                "status": "ok" if overall_healthy else "degraded",
                "version": "1.0.0",
                "environment": settings.ENVIRONMENT,
                "services": {
                    "database": "connected" if db_healthy else "disconnected",
                    "redis": "connected" if redis_healthy else "disconnected",
                },
            },
        )

    # ---- Prometheus Metrics ----
    register_metrics_endpoint(app)

    return app


# ---- Application Instance ----
app = create_app()

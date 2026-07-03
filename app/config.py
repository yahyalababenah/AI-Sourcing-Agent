"""
AI-Sourcing Hub — Pydantic Settings

Centralized configuration loaded from environment variables.
All secrets and URLs are validated at startup.
"""

from functools import cached_property
from typing import ClassVar

from pydantic import computed_field, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- Environment ----
    ENVIRONMENT: str = Field(default="development", pattern="^(development|staging|production)$")

    # ---- Database ----
    DB_PASSWORD: str = Field(min_length=8)
    DATABASE_URL: str | None = None  # If not set, constructed from parts

    @computed_field
    @cached_property
    def db_url(self) -> str:
        from sqlalchemy.engine import make_url
        raw = self.DATABASE_URL or f"postgresql+asyncpg://app_user:{self.DB_PASSWORD}@postgres:5432/aisourcing"
        # Ensure driver is asyncpg
        parsed = make_url(raw)
        if parsed.drivername in ("postgresql", "postgres"):
            parsed = parsed.set(drivername="postgresql+asyncpg")
        # asyncpg rejects sslmode= in query string — strip it entirely.
        # SSL is handled via connect_args ssl= in database.py.
        query = {k: v for k, v in parsed.query.items() if k != "sslmode"}
        # render_as_string(hide_password=False) preserves the real password.
        # str() would replace it with "***", causing auth failures.
        return parsed.set(query=query).render_as_string(hide_password=False)

    # ---- Redis ----
    REDIS_PASSWORD: str = Field(min_length=8)
    REDIS_URL: str | None = None

    @computed_field
    @cached_property
    def redis_url(self) -> str:
        if self.REDIS_URL:
            return self.REDIS_URL
        return f"redis://:{self.REDIS_PASSWORD}@redis:6379/0"

    # Celery URL overrides (for production/PaaS like Railway where Redis URL is provided directly)
    CELERY_BROKER_URL: str | None = None
    CELERY_RESULT_BACKEND: str | None = None

    @computed_field
    @cached_property
    def celery_broker_url(self) -> str:
        if self.CELERY_BROKER_URL:
            return self.CELERY_BROKER_URL
        return f"redis://:{self.REDIS_PASSWORD}@redis:6379/1"

    @computed_field
    @cached_property
    def celery_result_backend(self) -> str:
        if self.CELERY_RESULT_BACKEND:
            return self.CELERY_RESULT_BACKEND
        return f"redis://:{self.REDIS_PASSWORD}@redis:6379/2"

    # ---- JWT Authentication ----
    JWT_SECRET: str = Field(min_length=32)
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=15, ge=1, le=1440)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, ge=1, le=30)

    # ---- LLM API Providers ----
    TOGETHER_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""

    @property
    def has_llm_provider(self) -> bool:
        """Check if at least one LLM provider is configured."""
        return bool(self.TOGETHER_API_KEY or self.OPENROUTER_API_KEY or self.DEEPSEEK_API_KEY)

    # ---- OCR ----
    # PaddleOCR language model: "en" (Latin script incl. numbers/SKUs), "ch"
    # (Chinese+English), "arabic" (Arabic script). One model per deployment —
    # pick whichever matches the majority of scanned documents you receive.
    OCR_LANG: str = "en"

    # ---- Exchange Rate API ----
    EXCHANGE_RATE_API_KEY: str = ""

    # ---- Object Storage (S3-compatible: MinIO local / Supabase / Backblaze in production) ----
    # Generic S3 vars (preferred — works with any S3-compatible provider)
    S3_ENDPOINT: str | None = None          # e.g. https://<project>.supabase.co/storage/v1/s3
    S3_ACCESS_KEY: str | None = None
    S3_SECRET_KEY: str | None = None
    S3_REGION: str = Field(default="auto")  # "auto" works for Supabase/Backblaze
    # Legacy MinIO vars (Docker Compose local dev — kept for backwards compat)
    MINIO_ACCESS_KEY: str = Field(default="minioadmin")
    MINIO_SECRET_KEY: str = Field(default="minioadmin")
    MINIO_ENDPOINT: str = Field(default="minio:9000")
    MINIO_SECURE: bool = Field(default=False)

    STORAGE_BUCKET_DOCUMENTS: str = Field(default="aisourcing-documents")
    STORAGE_BUCKET_QUOTES: str = Field(default="aisourcing-quotes")

    @computed_field
    @cached_property
    def s3_endpoint_url(self) -> str:
        """Resolved S3 endpoint URL — prefers S3_ENDPOINT over MINIO_ENDPOINT."""
        if self.S3_ENDPOINT:
            return self.S3_ENDPOINT
        scheme = "https" if self.MINIO_SECURE else "http"
        return f"{scheme}://{self.MINIO_ENDPOINT}"

    @computed_field
    @cached_property
    def s3_access_key(self) -> str:
        return self.S3_ACCESS_KEY or self.MINIO_ACCESS_KEY

    @computed_field
    @cached_property
    def s3_secret_key(self) -> str:
        return self.S3_SECRET_KEY or self.MINIO_SECRET_KEY

    # ---- Sentry ----
    SENTRY_DSN: str = ""

    @property
    def sentry_enabled(self) -> bool:
        return bool(self.SENTRY_DSN)

    # ---- Security ----
    ALLOWED_HOSTS: list[str] = Field(
        default=["localhost", "127.0.0.1", "api", "*.aisourcing.example.com"]
    )
    CORS_ORIGINS: list[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:8000",
            "http://localhost:5173",
            "https://ai-sourcing-agent-rbv5zt8nv-yahia-s-projects05.vercel.app",
            "https://yahyoha-ai-sourcing-hub.hf.space",
        ]
    )

    @computed_field
    @cached_property
    def cors_config(self) -> dict:
        """CORS middleware configuration dict."""
        return {
            "allow_origins": self.CORS_ORIGINS,
            "allow_credentials": True,
            "allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            "allow_headers": ["*"],
        }

    # ---- Celery ----
    CELERY_TASK_SOFT_TIME_LIMIT: int = Field(default=180, ge=30)
    CELERY_TASK_TIME_LIMIT: int = Field(default=200, ge=60)
    # Whether a Celery worker is available. On single-container hosts (e.g. HF
    # Spaces) there is no worker, so document processing must run inline and the
    # health check must not wait out a dead broker ping. Set False there.
    CELERY_ENABLED: bool = Field(default=True)

    # ---- Rate Limiting ----
    RATE_LIMIT_GENERAL: str = Field(default="100/minute")
    RATE_LIMIT_UPLOAD: str = Field(default="10/minute")
    RATE_LIMIT_AUTH: str = Field(default="5/minute")
    # "redis" (shared across instances) or "memory" (per-process, no network).
    # Use "memory" on single-instance deploys to drop ~3 remote Redis round
    # trips from every request.
    RATE_LIMIT_BACKEND: str = Field(default="redis", pattern="^(redis|memory)$")

    # ---- Auth ----
    # Per-request Redis GET that checks whether a session was invalidated (logout
    # / forced logout). Fail-open and cheap only when Redis is local. Disable on
    # remote-Redis single-instance demos — short-lived access tokens make the
    # extra round trip not worth its latency.
    AUTH_SESSION_CHECK_ENABLED: bool = Field(default=True)

    # ---- Trusted Proxies ----
    # CIDRs whose X-Forwarded-For header is trusted.
    # In production this should be the Nginx container subnet only.
    # Default covers all RFC-1918 private ranges (safe for Docker Compose internal networks).
    TRUSTED_PROXY_CIDRS: list[str] = Field(
        default=["127.0.0.1/32", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
    )

    # ---- Validation ----
    @field_validator("DB_PASSWORD", "REDIS_PASSWORD", "JWT_SECRET")
    @classmethod
    def check_not_default(cls, v: str, info: Field) -> str:
        """Warn if using default/placeholder values."""
        forbidden = {
            "change_me",
            "placeholder",
            "password",
            "secret",
            "default",
            "admin",
        }
        if any(f in v.lower() for f in forbidden):
            raise ValueError(
                f"{info.field_name} contains a forbidden placeholder word. "
                f"Generate a strong, unique value."
            )
        return v

    @field_validator("CORS_ORIGINS")
    @classmethod
    def no_localhost_in_production(cls, v: list[str], info: Field) -> list[str]:
        """Reject localhost origins in production to prevent accidental misconfig."""
        import os
        env = os.getenv("ENVIRONMENT", "development")
        if env == "production":
            for origin in v:
                if "localhost" in origin or "127.0.0.1" in origin:
                    raise ValueError(
                        f"CORS_ORIGINS contains '{origin}' which is not allowed in production. "
                        "Set CORS_ORIGINS to the actual frontend domain."
                    )
        return v


# Singleton instance
settings = Settings()

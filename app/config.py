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
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql+asyncpg://app_user:{self.DB_PASSWORD}@postgres:5432/aisourcing"
        )

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

    @property
    def has_llm_provider(self) -> bool:
        """Check if at least one LLM provider is configured."""
        return bool(self.TOGETHER_API_KEY or self.OPENROUTER_API_KEY)

    # ---- Exchange Rate API ----
    EXCHANGE_RATE_API_KEY: str = ""

    # ---- Object Storage (MinIO/S3) ----
    MINIO_ACCESS_KEY: str = Field(default="minioadmin")
    MINIO_SECRET_KEY: str = Field(default="minioadmin")
    MINIO_ENDPOINT: str = Field(default="minio:9000")
    MINIO_SECURE: bool = Field(default=False)
    STORAGE_BUCKET_DOCUMENTS: str = Field(default="aisourcing-documents")
    STORAGE_BUCKET_QUOTES: str = Field(default="aisourcing-quotes")

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
        default=["http://localhost:3000", "http://localhost:8000"]
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

    # ---- Rate Limiting ----
    RATE_LIMIT_GENERAL: str = Field(default="100/minute")
    RATE_LIMIT_UPLOAD: str = Field(default="10/minute")

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


# Singleton instance
settings = Settings()

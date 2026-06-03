"""
AI-Sourcing Hub — Centralized Test Configuration

All test secret values and environment overrides live here.
Each default value can be overridden at CI-time by setting the
corresponding ``TEST_*`` environment variable (e.g.
``TEST_DB_PASSWORD``, ``TEST_JWT_SECRET``).

Usage in test files::

    from tests.test_config import TEST_ENV_OVERRIDES, TEST_PASSWORD, ...
"""

from __future__ import annotations

import os
from typing import Final

# ═══════════════════════════════════════════════════════════════
# Default test environment overrides
# ═══════════════════════════════════════════════════════════════
# These replace the values that were previously hardcoded directly
# in conftest.py.  Each can be overridden at CI-time by setting a
# TEST_* environment variable.

_DEFAULT_TEST_ENV: Final[dict[str, str]] = {
    "ENVIRONMENT": "testing",
    "DB_PASSWORD": "test_password_123",
    "REDIS_PASSWORD": "test_redis_123",
    "JWT_SECRET": "test_jwt_secret_key_32_chars_long!!",
    "DATABASE_URL": "sqlite+aiosqlite:///./test.db",
    "REDIS_URL": "redis://localhost:6379/9",
    "MINIO_ENDPOINT": "localhost:9000",
    "ALLOWED_HOSTS": '["*"]',
    "CORS_ORIGINS": '["*"]',
}


def _load_test_env() -> dict[str, str]:
    """Return test environment overrides, honouring ``TEST_*`` env vars.

    For each key in the defaults, if ``TEST_{KEY}`` is set in the
    actual environment, its value is used instead of the default.
    """
    resolved: dict[str, str] = {}
    for key, default in _DEFAULT_TEST_ENV.items():
        env_var = f"TEST_{key}"
        resolved[key] = os.environ.get(env_var, default)
    return resolved


#: Dict of environment variables that should be applied early by
#: ``conftest.py`` (e.g. ``os.environ["DB_PASSWORD"] = ...``).
TEST_ENV_OVERRIDES: Final[dict[str, str]] = _load_test_env()

# ═══════════════════════════════════════════════════════════════
# Test Auth Credentials
# ═══════════════════════════════════════════════════════════════
# These are used by pytest fixtures to create + authenticate test
# users.  Keep them synchronised with TEST_ENV_OVERRIDES if you
# change the JWT_SECRET or similar.

#: Password used by conftest ``auth_headers`` / ``client_headers`` fixtures.
TEST_PASSWORD: Final[str] = "testpass123"

#: Admin user email + password used by conftest ``admin_headers`` fixture.
TEST_ADMIN_EMAIL: Final[str] = "admin@example.com"
TEST_ADMIN_PASSWORD: Final[str] = "adminpass123"

#: Legacy password still used by ``test_auth_api.py`` and
#: ``test_intake_api.py`` fixtures.
TEST_LEGACY_PASSWORD: Final[str] = "test_password_123"

# ═══════════════════════════════════════════════════════════════
# E2E Audit Credentials
# ═══════════════════════════════════════════════════════════════
# Used by ``e2e_audit.py``.  The demo credentials must match the
# ``scripts/seed_demo_users.py`` output.

#: Password for dynamically-created E2E test users.
E2E_TEST_PASSWORD: Final[str] = "TestPass123!"

#: Pre-seeded demo user credentials (must match seed_demo_users.py).
DEMO_ADMIN_EMAIL: Final[str] = "admin@example.com"
DEMO_ADMIN_PASSWORD: Final[str] = "password123"
DEMO_AGENT_EMAIL: Final[str] = "agent@example.com"
DEMO_AGENT_PASSWORD: Final[str] = "password123"
DEMO_CLIENT_EMAIL: Final[str] = "client@example.com"
DEMO_CLIENT_PASSWORD: Final[str] = "password123"

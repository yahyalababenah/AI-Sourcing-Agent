"""
AI-Sourcing Hub — Pytest Configuration & Fixtures

Uses testcontainers for PostgreSQL and Redis in CI/local testing.
For lightweight runs, uses SQLite (aiosqlite) as a substitute.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.main import create_app
from app.shared.database import Base, get_db
from app.shared.redis_client import get_redis_client

# ═══════════════════════════════════════════════════════════
# Settings Override for Tests
# ═══════════════════════════════════════════════════════════

# Force test settings before importing app modules
import os

os.environ["ENVIRONMENT"] = "testing"
os.environ["DB_PASSWORD"] = "test_password_123"
os.environ["REDIS_PASSWORD"] = "test_redis_123"
os.environ["JWT_SECRET"] = "test_jwt_secret_key_32_chars_long!!"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"
os.environ["REDIS_URL"] = "redis://localhost:6379/9"
os.environ["MINIO_ENDPOINT"] = "localhost:9000"
os.environ["ALLOWED_HOSTS"] = '["*"]'
os.environ["CORS_ORIGINS"] = '["*"]'

# ═══════════════════════════════════════════════════════════
# SQLite Compiler Workaround for JSONB Columns
# ═══════════════════════════════════════════════════════════

# Our production models use PostgreSQL's JSONB for strict performance,
# but SQLite cannot natively compile JSONB.  The @compiles decorator
# below registers a custom compiler that tells SQLite to treat JSONB
# columns as plain JSON (stored as TEXT), which is fully compatible
# for test/development purposes.
#
# IMPORTANT: This does NOT alter any model definitions — production
# deployments using real PostgreSQL will continue to use JSONB natively.
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_as_json(element, compiler, **kw):
    """Render JSONB columns as JSON (TEXT) when using SQLite."""
    return compiler.visit_JSON(element, **kw)


# ═══════════════════════════════════════════════════════════
# Event Loop
# ═══════════════════════════════════════════════════════════

@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create a single event loop for the test session."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()


# ═══════════════════════════════════════════════════════════
# Database
# ═══════════════════════════════════════════════════════════

@pytest_asyncio.fixture(scope="session")
async def db_engine():
    """Create the test database engine and all tables."""
    engine = create_async_engine("sqlite+aiosqlite:///./test.db", echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test."""
    session_factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session
        await session.rollback()


# ═══════════════════════════════════════════════════════════
# FastAPI App & Client
# ═══════════════════════════════════════════════════════════

@pytest_asyncio.fixture
async def app(db_session: AsyncSession):
    """Create the FastAPI app with overridden DB and Redis dependencies."""
    application = create_app()

    async def override_get_db():
        yield db_session

    async def override_get_redis():
        """Yield an AsyncMock Redis client to avoid needing a real Redis server."""
        mock_redis = AsyncMock()
        yield mock_redis

    application.dependency_overrides[get_db] = override_get_db
    application.dependency_overrides[get_redis_client] = override_get_redis
    return application


@pytest_asyncio.fixture
async def client(app) -> AsyncGenerator[AsyncClient, None]:
    """Create an async HTTP client for testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ═══════════════════════════════════════════════════════════
# Auth Fixtures
# ═══════════════════════════════════════════════════════════

@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient, db_session: AsyncSession) -> dict:
    """Register a user and return auth headers."""
    from app.modules.auth.service import register_user
    from app.modules.auth.schemas import UserCreate
    import uuid

    unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    user = await register_user(
        db_session,
        UserCreate(
            email=unique_email,
            password="testpass123",
            full_name="Test Agent",
        ),
    )

    # Login to get tokens
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "testpass123"},
    )
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest_asyncio.fixture
async def admin_headers(client: AsyncClient, db_session: AsyncSession) -> dict:
    """Create an admin user and return auth headers."""
    from app.modules.auth.models import User, UserRole
    from app.modules.auth.service import _hash_password
    import uuid

    admin = User(
        id=uuid.uuid4(),
        email="admin@example.com",
        password_hash=_hash_password("adminpass123"),
        full_name="Admin User",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(admin)
    await db_session.flush()

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "adminpass123"},
    )
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}

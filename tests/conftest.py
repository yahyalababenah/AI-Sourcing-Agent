"""
AI-Sourcing Hub — Pytest Configuration & Fixtures

Uses testcontainers for PostgreSQL and Redis in CI/local testing.
For lightweight runs, uses SQLite (aiosqlite) as a substitute.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import asyncio
import logging
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

# Force test settings before importing app modules.
# Values come from the centralized test configuration so they can be
# overridden at CI-time via TEST_* environment variables.
import os

from tests.test_config import TEST_ENV_OVERRIDES

for key, val in TEST_ENV_OVERRIDES.items():
    os.environ[key] = val

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
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID as PG_UUID
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_as_json(element, compiler, **kw):
    """Render JSONB columns as JSON (TEXT) when using SQLite."""
    return compiler.visit_JSON(element, **kw)


@compiles(TSVECTOR, "sqlite")
def _compile_tsvector_as_text(element, compiler, **kw):
    """Render PostgreSQL TSVECTOR columns as TEXT when using SQLite.

    ``CatalogProduct.search_vector`` uses PostgreSQL's built-in
    ``tsvector`` type for full-text search with a GIN index.  Since
    SQLite lacks native full-text search types, we store the vector
    as plain TEXT — the trigger-based population logic is skipped in
    tests anyway.
    """
    return "TEXT"


@compiles(PG_UUID, "sqlite")
def _compile_uuid_as_varchar(element, compiler, **kw):
    """Render PostgreSQL UUID columns as VARCHAR(36) when using SQLite.

    Without this, SQLite does not know how to store UUID columns — the
    PostgreSQL UUID type compiles to the literal string "UUID", which SQLite
    treats as an unknown type affinity, causing integer coercion and raising
    ``AttributeError: 'int' object has no attribute 'replace'`` when the
    type's result processor tries to build a ``uuid.UUID`` object from the
    returned value.

    By compiling to VARCHAR(36) (the standard 36-char hex UUID string), the
    built-in ``uuid.UUID()`` constructor receives a proper string and the
    conversion succeeds.
    """
    return compiler.visit_VARCHAR(element, **kw)


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

logger = logging.getLogger(__name__)

from sqlalchemy.exc import OperationalError


@pytest_asyncio.fixture(scope="session")
async def db_engine():
    """Create the test database engine and all tables."""
    engine = create_async_engine("sqlite+aiosqlite://", echo=False)

    async with engine.begin() as conn:
        try:
            await conn.run_sync(Base.metadata.create_all)
        except OperationalError:
            # CatalogProduct registers PostgreSQL-specific ``after_create``
            # DDL events (PL/pgSQL function + trigger) that SQLite cannot
            # compile.  These are non-essential in a test context — the
            # ``search_vector`` column is populated by a PostgreSQL trigger
            # in production but not needed for SQLite test runs.
            logger.warning(
                "Ignoring OperationalError during table creation "
                "(likely PostgreSQL-specific DDL on SQLite)"
            )

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
    """Register an agent (supplier) and return auth headers."""
    from app.modules.auth.service import register_user
    from app.modules.auth.schemas import UserCreate
    from tests.test_config import TEST_PASSWORD
    import uuid

    unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    user = await register_user(
        db_session,
        UserCreate(
            email=unique_email,
            password=TEST_PASSWORD,
            full_name="Test Agent",
            role="agent",
            factory_name="Test Factory",
            location_in_china="Guangzhou, Guangdong",
            specialty="Test Goods",
            business_registration_number="CN-TEST-001",
        ),
    )

    # Login to get tokens
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": TEST_PASSWORD},
    )
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest_asyncio.fixture
async def client_headers(client: AsyncClient, db_session: AsyncSession) -> dict:
    """Register a client (buyer) and return auth headers."""
    from app.modules.auth.service import register_user
    from app.modules.auth.schemas import UserCreate
    import uuid

    from tests.test_config import TEST_PASSWORD

    unique_email = f"client_{uuid.uuid4().hex[:8]}@example.com"
    user = await register_user(
        db_session,
        UserCreate(
            email=unique_email,
            password=TEST_PASSWORD,
            full_name="Test Client",
            role="client",
            company_name="Test Corp",
            preferred_port="Aqaba",
            contact_number="+962700000000",
        ),
    )

    # Login to get tokens
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": TEST_PASSWORD},
    )
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest_asyncio.fixture
async def admin_headers(client: AsyncClient, db_session: AsyncSession) -> dict:
    """Create an admin user and return auth headers."""
    from app.modules.auth.models import User, UserRole
    from app.modules.auth.service import _hash_password
    from tests.test_config import TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
    import uuid

    admin = User(
        id=uuid.uuid4(),
        email=TEST_ADMIN_EMAIL,
        password_hash=_hash_password(TEST_ADMIN_PASSWORD),
        full_name="Admin User",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(admin)
    await db_session.flush()

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": TEST_ADMIN_EMAIL, "password": TEST_ADMIN_PASSWORD},
    )
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}

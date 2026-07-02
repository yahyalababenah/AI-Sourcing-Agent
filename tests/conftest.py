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
from typing import AsyncGenerator, Generator, Optional

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
        # Create tables one at a time (in FK-dependency order) rather than a
        # single bulk create_all(). CatalogProduct registers PostgreSQL-only
        # ``after_create`` DDL events (PL/pgSQL trigger function) that SQLite
        # can't compile — but create_all() runs as one transaction/call, so an
        # OperationalError partway through previously aborted the *entire*
        # batch, silently skipping every table ordered after catalog_products
        # (e.g. quotation_line_items, which FKs to it). Isolating each table's
        # creation means only catalog_products' own trigger DDL is skipped;
        # everything else still gets created normally.
        for table in Base.metadata.sorted_tables:
            try:
                await conn.run_sync(Base.metadata.create_all, tables=[table])
            except OperationalError:
                logger.warning(
                    "Ignoring OperationalError creating table %s "
                    "(likely PostgreSQL-specific DDL on SQLite)",
                    table.name,
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
async def redis_client():
    """Yield a fakeredis client with real Redis semantics (TTL, key expiry, etc.).

    Docker/testcontainers isn't available in every environment this suite
    runs in, so we use fakeredis instead — it implements the actual Redis
    command set (GET/SETEX/EXPIRE/SCAN/pipelines/...) in pure Python, unlike
    ``AsyncMock`` which can't verify real behavior like blacklist TTL expiry.
    """
    import fakeredis.aioredis as fakeredis_aioredis

    client = fakeredis_aioredis.FakeRedis(decode_responses=True)
    yield client
    await client.flushall()
    await client.aclose()


@pytest_asyncio.fixture
async def app(db_session: AsyncSession, redis_client):
    """Create the FastAPI app with overridden DB and Redis dependencies."""
    application = create_app()

    async def override_get_db():
        yield db_session

    async def override_get_redis():
        yield redis_client

    application.dependency_overrides[get_db] = override_get_db
    application.dependency_overrides[get_redis_client] = override_get_redis
    return application


class SSEStream:
    """A single manually-driven ASGI connection to a StreamingResponse route.

    ``httpx.ASGITransport`` runs the whole ASGI app to completion before
    returning anything to the caller (see ``ASGITransport.handle_async_request``:
    ``await self.app(scope, receive, send)`` happens before the Response is
    built) — so it can never observe an infinite/long-lived SSE stream; the
    request just hangs forever. This drives the app's ASGI callable directly
    as a background task and reads ``send()`` messages off a queue instead,
    which lets tests observe events from a genuinely never-ending stream.
    """

    def __init__(self, task: "asyncio.Task", queue: "asyncio.Queue"):
        self._task = task
        self._queue = queue
        self.status_code: int | None = None

    async def _start(self) -> None:
        message = await asyncio.wait_for(self._queue.get(), timeout=5.0)
        assert message["type"] == "http.response.start"
        self.status_code = message["status"]

    async def next_event(self, timeout: float = 2.0) -> dict:
        """Read one SSE ``event: X\\ndata: {...}\\n\\n`` body chunk."""
        message = await asyncio.wait_for(self._queue.get(), timeout=timeout)
        assert message["type"] == "http.response.body"
        body = message["body"].decode()
        event_type, data = None, None
        for line in body.split("\n"):
            if line.startswith("event:"):
                event_type = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                import json as _json

                data = _json.loads(line.split(":", 1)[1].strip())
        return {"event": event_type, "data": data}

    async def aclose(self) -> None:
        self._task.cancel()
        try:
            await self._task
        except (asyncio.CancelledError, Exception):
            pass


@pytest_asyncio.fixture
async def open_sse_stream(app):
    """Factory fixture: ``stream = await open_sse_stream("/path", query_string="a=b")``."""
    opened: list[SSEStream] = []

    async def _open(path: str, query_string: str = "", headers: Optional[dict] = None) -> SSEStream:
        queue: asyncio.Queue = asyncio.Queue()

        async def receive():
            await asyncio.sleep(3600)
            return {"type": "http.disconnect"}

        async def send(message):
            await queue.put(message)

        raw_headers = [(b"host", b"test")]
        for key, value in (headers or {}).items():
            raw_headers.append((key.lower().encode(), value.encode()))

        scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "GET",
            "headers": raw_headers,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode(),
            "query_string": query_string.encode(),
            "server": ("test", 80),
            "client": ("test", 123),
            "root_path": "",
        }
        task = asyncio.create_task(app(scope, receive, send))
        stream = SSEStream(task, queue)
        await stream._start()
        opened.append(stream)
        return stream

    yield _open

    for stream in opened:
        await stream.aclose()


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


# ═══════════════════════════════════════════════════════════
# Celery
# ═══════════════════════════════════════════════════════════

@pytest.fixture
def celery_eager():
    """Run Celery tasks synchronously in-process via ``.delay()``/``.apply_async()``.

    Use for tests that need a task's side effects (e.g. PDF generation) without
    a running worker. Tests that exercise the real Celery Beat schedule or
    worker/broker behavior should call the task function directly instead.
    """
    from app.shared.celery_app import celery_app

    celery_app.conf.update(task_always_eager=True, task_eager_propagates=True)
    yield celery_app
    celery_app.conf.update(task_always_eager=False, task_eager_propagates=False)


# ═══════════════════════════════════════════════════════════
# Entity Factories
# ═══════════════════════════════════════════════════════════
# Lightweight fixture-factories (not factory_boy) that build persisted rows
# with sensible defaults, overridable via kwargs. Matches this project's
# existing style of manual fixtures over declarative factory libraries.

@pytest_asyncio.fixture
def make_user(db_session: AsyncSession):
    """Factory for a persisted ``User`` row (no HTTP registration/login)."""

    async def _make_user(role: str = "agent", **overrides):
        import uuid as _uuid

        from app.modules.auth.models import User, UserRole
        from app.modules.auth.service import _hash_password
        from tests.test_config import TEST_PASSWORD

        defaults = dict(
            id=_uuid.uuid4(),
            email=f"user_{_uuid.uuid4().hex[:8]}@example.com",
            password_hash=_hash_password(TEST_PASSWORD),
            full_name="Test User",
            role=UserRole(role),
            is_active=True,
        )
        defaults.update(overrides)
        user = User(**defaults)
        db_session.add(user)
        await db_session.flush()
        return user

    return _make_user


@pytest_asyncio.fixture
def make_rfq(db_session: AsyncSession, make_user):
    """Factory for a persisted ``RFQ`` row."""

    async def _make_rfq(agent=None, client=None, **overrides):
        import uuid as _uuid

        from app.modules.intake.models import RFQ, RFQStatus

        if agent is None:
            agent = await make_user(role="agent")

        defaults = dict(
            id=_uuid.uuid4(),
            agent_id=agent.id,
            client_id=client.id if client else None,
            client_name="Test Client",
            client_request_arabic="أحتاج 100 قطعة إضاءة صناعية",
            status=RFQStatus.OPEN,
            destination_port="Aqaba",
            target_currency="JOD",
            is_public=False,
        )
        defaults.update(overrides)
        rfq = RFQ(**defaults)
        db_session.add(rfq)
        await db_session.flush()
        return rfq

    return _make_rfq


@pytest_asyncio.fixture
def make_product(db_session: AsyncSession, make_rfq):
    """Factory for a persisted ``Product`` row, tied to an RFQ."""

    async def _make_product(rfq=None, **overrides):
        import uuid as _uuid

        from app.modules.intake.models import Product, ProductStatus

        if rfq is None:
            rfq = await make_rfq()

        defaults = dict(
            id=_uuid.uuid4(),
            rfq_id=rfq.id,
            name="Industrial LED Floodlight",
            quantity=100,
            target_price=25.0,
            status=ProductStatus.PENDING,
        )
        defaults.update(overrides)
        product = Product(**defaults)
        db_session.add(product)
        await db_session.flush()
        return product

    return _make_product


@pytest_asyncio.fixture
def make_document(db_session: AsyncSession, make_rfq, make_user):
    """Factory for a persisted ``Document`` row."""

    async def _make_document(rfq=None, uploaded_by=None, **overrides):
        import uuid as _uuid

        from app.modules.documents.models import Document, DocumentStatus, DocumentType

        if uploaded_by is None:
            uploaded_by = await make_user(role="agent")
        if rfq is None:
            rfq = await make_rfq(agent=uploaded_by)

        defaults = dict(
            id=_uuid.uuid4(),
            rfq_id=rfq.id,
            uploaded_by_id=uploaded_by.id,
            file_name="catalog.pdf",
            file_path=f"test-bucket/{_uuid.uuid4().hex}.pdf",
            content_type="application/pdf",
            doc_type=DocumentType.PDF,
            status=DocumentStatus.UPLOADED,
        )
        defaults.update(overrides)
        document = Document(**defaults)
        db_session.add(document)
        await db_session.flush()
        return document

    return _make_document


@pytest_asyncio.fixture
def make_catalog_product(db_session: AsyncSession, make_document, make_user):
    """Factory for a persisted ``CatalogProduct`` row."""

    async def _make_catalog_product(document=None, supplier=None, **overrides):
        import uuid as _uuid

        from app.modules.catalog.models import CatalogProduct, ProductReviewStatus

        if supplier is None:
            supplier = await make_user(role="agent")
        if document is None:
            document = await make_document(uploaded_by=supplier)

        defaults = dict(
            id=_uuid.uuid4(),
            document_id=document.id,
            supplier_id=supplier.id,
            product_name="工业LED投光灯",
            model_number="LED-FL-100W",
            unit_price_rmb=45.0,
            moq=50,
            weight_kg=1.2,
            category="Industrial Lighting",
            review_status=ProductReviewStatus.PENDING,
        )
        defaults.update(overrides)
        catalog_product = CatalogProduct(**defaults)
        db_session.add(catalog_product)
        await db_session.flush()
        return catalog_product

    return _make_catalog_product


@pytest_asyncio.fixture
def make_quotation(db_session: AsyncSession, make_rfq, make_user):
    """Factory for a persisted ``Quotation`` row."""

    async def _make_quotation(rfq=None, agent=None, **overrides):
        import uuid as _uuid

        from app.modules.output.models import Quotation, QuotationStatus

        if agent is None:
            agent = await make_user(role="agent")
        if rfq is None:
            rfq = await make_rfq(agent=agent)

        defaults = dict(
            id=_uuid.uuid4(),
            rfq_id=rfq.id,
            agent_id=agent.id,
            quotation_number=f"Q-{_uuid.uuid4().hex[:8].upper()}",
            status=QuotationStatus.DRAFT,
            target_currency="JOD",
            exchange_rate_used=0.20,
            subtotal=1000.0,
            grand_total=1150.0,
        )
        defaults.update(overrides)
        quotation = Quotation(**defaults)
        db_session.add(quotation)
        await db_session.flush()
        return quotation

    return _make_quotation

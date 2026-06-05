"""
AI-Sourcing Hub — Async SQLAlchemy Database Layer

Provides:
- Async engine with connection pooling
- Async session factory
- Declarative Base for all models
- FastAPI dependency for session injection

Usage:
    from app.shared.database import get_db

    @router.get("/items")
    async def get_items(db: AsyncSession = Depends(get_db)):
        ...
"""

from collections.abc import AsyncGenerator

from sqlalchemy import URL, create_engine, make_url
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# ---- Async Engine with Connection Pooling ----
engine = create_async_engine(
    settings.db_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False,
    connect_args={
        "statement_cache_size": 0,  # Disable for asyncpg compatibility
    },
)

# ---- Session Factory ----
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ---- Declarative Base ----
class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""


# ---- FastAPI Dependency ----
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async DB session.

    Usage:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ═══════════════════════════════════════════════════════════
# Sync Session Factory (for Celery tasks)
# ═══════════════════════════════════════════════════════════


def _build_sync_db_url() -> str:
    """Convert async database URL to sync URL using proper URL parsing.

    Uses SQLAlchemy's URL.create() instead of fragile string replacement.
    """
    parsed = make_url(settings.db_url)
    sync_url = URL.create(
        drivername="postgresql",
        username=parsed.username,
        password=parsed.password,
        host=parsed.host,
        port=parsed.port,
        database=parsed.database,
    )
    return str(sync_url)


def create_sync_session_factory(
    pool_size: int = 2,
    max_overflow: int = 4,
    pool_pre_ping: bool = True,
    pool_recycle: int = 3600,
) -> sessionmaker:
    """Create a sync SQLAlchemy session factory for Celery tasks.

    Parses the asyncpg URL and rebuilds it with the sync ``postgresql``
    driver, avoiding fragile string replacement that can break with
    unexpected URL formats or query parameters.

    Each module can configure its own pool settings:

        SyncSession = create_sync_session_factory(pool_size=5, max_overflow=10)
        with SyncSession() as session:
            session.execute(...)

    Args:
        pool_size: Number of connections to maintain in the pool.
        max_overflow: Maximum overflow connections beyond pool_size.
        pool_pre_ping: Whether to ping connections before using them.
        pool_recycle: Recycle connections after this many seconds.

    Returns:
        A ``sessionmaker`` bound to the sync engine.
    """
    sync_url = _build_sync_db_url()
    engine = create_engine(
        sync_url,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_pre_ping=pool_pre_ping,
        pool_recycle=pool_recycle,
    )
    return sessionmaker(bind=engine)

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

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

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

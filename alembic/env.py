"""
AI-Sourcing Hub — Alembic Environment Configuration

Alembic uses a synchronous database driver for migrations.
We configure it to use the async models' metadata with psycopg2 (sync).
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

# Alembic Config object
config = context.config

# Set up Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── Import all models so Alembic can detect them ──
from app.shared.database import Base  # noqa: F401

# Import each module's models to register them with the metadata
import app.modules.auth.models  # noqa: F401
import app.modules.intake.models  # noqa: F401
import app.modules.documents.models  # noqa: F401
import app.modules.pricing.models  # noqa: F401
import app.modules.output.models  # noqa: F401

# Target metadata for autogenerate
target_metadata = Base.metadata

# Other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Configures the context with just a URL and not an Engine,
    though an Engine is acceptable here as well.  By skipping
    the Engine creation we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    """Run migrations with a connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode using async engine."""
    # Override sqlalchemy.url with the async URL
    # In production, this would come from the .env file
    from app.config import settings

    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.db_url

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    Uses an async engine and runs the sync migration functions
    via run_sync.
    """
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

"""
Alembic async migration environment.

Uses the async bridge pattern:
  async_engine_from_config  →  connection.run_sync(do_run_migrations)

Key requirements:
- pool.NullPool: migrations must NOT reuse pooled connections
- asyncio.run(): Alembic CLI has no running event loop; we create one here
- config.set_main_option: overrides alembic.ini sqlalchemy.url with .env value
"""
import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Make sure the project root is on sys.path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import settings and Base (which imports all models for autogenerate)
from app.core.config import settings  # noqa: E402
from app.db.base import Base          # noqa: E402

# Alembic Config object
config = context.config

# Override sqlalchemy.url from .env (single source of truth)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Setup loggers defined in alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata that Alembic uses for autogenerate comparison
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Offline mode: generate SQL without a live DB connection.
    Useful for producing a migration script to review before applying.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Synchronous migration runner — called from within the async context."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create async engine and bridge into Alembic's synchronous runner."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # CRITICAL: no pooling for migration runs
    )

    async with connectable.connect() as connection:
        # run_sync bridges the async connection back to the sync Alembic runner
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Entry point for online migrations (default mode)."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

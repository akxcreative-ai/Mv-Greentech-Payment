"""
Database Connection and Session Management.

Provides async SQLAlchemy engine, async sessionmaker, Base model class,
and async database session dependency for FastAPI.
Supports both PostgreSQL (production) and SQLite (development/preview).
"""

import logging
from typing import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Determine if using SQLite
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# Engine configuration differs between PostgreSQL and SQLite
if is_sqlite:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.is_development,
        future=True,
        connect_args={"check_same_thread": False},
    )
    
    # Enable WAL mode and foreign keys for SQLite
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
else:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.is_development,
        future=True,
        pool_size=10,
        max_overflow=20,
        pool_recycle=1800,
        pool_pre_ping=True,
        pool_timeout=30,
    )

# Async Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# Declarative Base for ORM Models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency yielding an async database session per request.
    Automatically commits on success, rolls back on exceptions, and closes session.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as exc:
            await session.rollback()
            logger.error("Database transaction rolled back due to error: %s", exc, exc_info=True)
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """
    Initializes database tables by creating all registered models in Base.metadata.
    """
    try:
        import app.models  # noqa: F401
    except ImportError:
        logger.debug("app.models not found; proceeding with current Base metadata.")

    logger.info("Initializing database schema...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema initialized successfully.")


async def close_db() -> None:
    """
    Closes and disposes of the database connection engine pool.
    """
    logger.info("Disposing database connection pool...")
    await engine.dispose()
    logger.info("Database connection pool disposed.")

"""
Base model and common mixins for MV Payment Approval System.
SQLAlchemy 2.0 style with UUID support for both PostgreSQL and SQLite.
"""

from datetime import datetime, timezone
from typing import Any, Dict
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    TypeDecorator,
    func,
    CHAR,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GUID(TypeDecorator):
    """Platform-independent UUID type.
    Uses PostgreSQL's UUID type when available, otherwise uses CHAR(36).
    """
    impl = CHAR(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            if isinstance(value, uuid.UUID):
                return str(value)
            return str(uuid.UUID(value))
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            if not isinstance(value, uuid.UUID):
                return uuid.UUID(value)
        return value

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            from sqlalchemy.dialects.postgresql import UUID as PGUUID
            return dialect.type_descriptor(PGUUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))


class UUIDMixin:
    """Mixin providing UUID primary key."""
    id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
        nullable=False,
    )


class TimeCreatedMixin:
    """Mixin providing immutable creation timestamp."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class TimestampMixin(TimeCreatedMixin):
    """Mixin providing creation and automatic update timestamps."""
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SoftDeleteMixin:
    """Mixin providing soft-delete functionality."""
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    def soft_delete(self) -> None:
        """Mark record as deleted."""
        self.is_deleted = True

    def restore(self) -> None:
        """Restore soft-deleted record."""
        self.is_deleted = False


class BaseModel(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """
    Abstract base model providing:
    - id: UUID primary key
    - created_at: Creation timestamp
    - updated_at: Last update timestamp
    - is_deleted: Soft delete flag (indexed)
    """
    __abstract__ = True

    def to_dict(self) -> Dict[str, Any]:
        """Convert model columns to dictionary."""
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }

    def __repr__(self) -> str:
        attrs = ", ".join(f"{col.name}={getattr(self, col.name)!r}" for col in self.__table__.primary_key.columns)
        return f"<{self.__class__.__name__}({attrs})>"

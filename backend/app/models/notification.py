"""
Notification model for MV Payment Approval System.
Alerts users to payment submissions, approval milestones, clarification requests, and disbursement events.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING, Optional
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
)
from app.models.base import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimeCreatedMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User


class NotificationType(str, Enum):
    """Categorized notification trigger events."""
    INFO = "INFO"
    SUCCESS = "SUCCESS"
    WARNING = "WARNING"
    ERROR = "ERROR"
    PAYMENT_SUBMITTED = "PAYMENT_SUBMITTED"
    PAYMENT_APPROVED = "PAYMENT_APPROVED"
    PAYMENT_REJECTED = "PAYMENT_REJECTED"
    CLARIFICATION_REQUESTED = "CLARIFICATION_REQUESTED"
    CLARIFICATION_PROVIDED = "CLARIFICATION_PROVIDED"
    PAYMENT_PROCESSED = "PAYMENT_PROCESSED"
    REMINDER = "REMINDER"
    SYSTEM = "SYSTEM"


class Notification(Base, UUIDMixin, TimeCreatedMixin):
    """
    User in-app and dispatch notification entity.
    """
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_unread", "user_id", "is_read"),
        Index("ix_notifications_entity", "entity_type", "entity_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Recipient user receiving this notification",
    )
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Notification subject/title header",
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Notification body message content",
    )
    type: Mapped[NotificationType] = mapped_column(
        SAEnum(NotificationType, name="notification_type_enum"),
        default=NotificationType.INFO,
        nullable=False,
        index=True,
        comment="Type classification of notification",
    )
    entity_type: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="Target model type (e.g. payment_request, approval)",
    )
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        nullable=True,
        index=True,
        comment="Target primary key ID of the associated entity",
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
        comment="Read receipt boolean flag",
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when notification was read by user",
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="notifications",
    )

    def mark_as_read(self) -> None:
        """Mark notification as read with current timestamp."""
        self.is_read = True
        self.read_at = datetime.now(timezone.utc)

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, user_id={self.user_id}, title='{self.title}', is_read={self.is_read})>"

"""
AuditLog model for MV Payment Approval System.
Maintains an immutable, comprehensive audit trail of system activities, state changes, and user actions.
"""

from enum import Enum
from typing import TYPE_CHECKING, Any, Dict, Optional
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


class AuditEventType(str, Enum):
    """Enumeration of all auditable events across the payment approval platform."""
    # Authentication & Session Events
    USER_LOGIN = "USER_LOGIN"
    USER_LOGOUT = "USER_LOGOUT"
    USER_LOGIN_FAILED = "USER_LOGIN_FAILED"
    USER_LOCKED = "USER_LOCKED"
    USER_UNLOCKED = "USER_UNLOCKED"
    PASSWORD_CHANGED = "PASSWORD_CHANGED"
    SESSION_EXPIRED = "SESSION_EXPIRED"

    # User & Role Management
    USER_CREATED = "USER_CREATED"
    USER_UPDATED = "USER_UPDATED"
    USER_DELETED = "USER_DELETED"
    ROLE_CREATED = "ROLE_CREATED"
    ROLE_UPDATED = "ROLE_UPDATED"
    ROLE_DELETED = "ROLE_DELETED"

    # Company & Department Management
    COMPANY_CREATED = "COMPANY_CREATED"
    COMPANY_UPDATED = "COMPANY_UPDATED"
    DEPARTMENT_CREATED = "DEPARTMENT_CREATED"
    DEPARTMENT_UPDATED = "DEPARTMENT_UPDATED"

    # Vendor Management
    VENDOR_CREATED = "VENDOR_CREATED"
    VENDOR_UPDATED = "VENDOR_UPDATED"
    VENDOR_DELETED = "VENDOR_DELETED"

    # Payment Request Lifecycle
    PAYMENT_REQUEST_CREATED = "PAYMENT_REQUEST_CREATED"
    PAYMENT_REQUEST_UPDATED = "PAYMENT_REQUEST_UPDATED"
    PAYMENT_REQUEST_SUBMITTED = "PAYMENT_REQUEST_SUBMITTED"
    PAYMENT_REQUEST_APPROVED = "PAYMENT_REQUEST_APPROVED"
    PAYMENT_REQUEST_REJECTED = "PAYMENT_REQUEST_REJECTED"
    PAYMENT_REQUEST_CLARIFICATION_REQUESTED = "PAYMENT_REQUEST_CLARIFICATION_REQUESTED"
    PAYMENT_REQUEST_CLARIFICATION_RESPONDED = "PAYMENT_REQUEST_CLARIFICATION_RESPONDED"
    PAYMENT_REQUEST_CANCELLED = "PAYMENT_REQUEST_CANCELLED"
    PAYMENT_REQUEST_ON_HOLD = "PAYMENT_REQUEST_ON_HOLD"
    PAYMENT_REQUEST_DUPLICATE_OVERRIDE = "PAYMENT_REQUEST_DUPLICATE_OVERRIDE"
    PAYMENT_REQUEST_DELETED = "PAYMENT_REQUEST_DELETED"

    # Payment Execution
    PAYMENT_RECORDED = "PAYMENT_RECORDED"
    PAYMENT_COMPLETED = "PAYMENT_COMPLETED"

    # Document & Attachment
    DOCUMENT_UPLOADED = "DOCUMENT_UPLOADED"
    DOCUMENT_DELETED = "DOCUMENT_DELETED"

    # Settings & Approval Rules
    SETTINGS_UPDATED = "SETTINGS_UPDATED"
    APPROVAL_RULE_CREATED = "APPROVAL_RULE_CREATED"
    APPROVAL_RULE_UPDATED = "APPROVAL_RULE_UPDATED"
    APPROVAL_RULE_DELETED = "APPROVAL_RULE_DELETED"

    # System & Generic
    SYSTEM_EVENT = "SYSTEM_EVENT"


class AuditLog(Base, UUIDMixin, TimeCreatedMixin):
    """
    Immutable compliance log recording actor, event, changed state diffs, and network metadata.
    """
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
        Index("ix_audit_logs_user_created", "user_id", "created_at"),
        Index("ix_audit_logs_created_at", "created_at"),
    )

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="User who triggered this event (nullable for system or unauthenticated actions)",
    )
    event_type: Mapped[AuditEventType] = mapped_column(
        SAEnum(AuditEventType, name="audit_event_type_enum"),
        nullable=False,
        index=True,
        comment="Categorized audit event classification",
    )
    entity_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Target model or domain object name (e.g. payment_request, user, vendor)",
    )
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        nullable=True,
        index=True,
        comment="Primary key UUID of the modified object",
    )
    previous_value: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True,
        comment="Pre-mutation snapshot of modified attributes as JSON",
    )
    new_value: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True,
        comment="Post-mutation snapshot of modified attributes as JSON",
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45),
        nullable=True,
        comment="Client IP address where action originated",
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Client user agent string",
    )

    # Relationships
    user: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="audit_logs",
    )

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, event='{self.event_type.value}', entity='{self.entity_type}', user_id={self.user_id})>"

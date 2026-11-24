"""
User model for MV Payment Approval System.
Handles user authentication, organizational hierarchy, profile details, and security state.
"""

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, JSON, Numeric, String, Text
from app.models.base import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.approval import ApprovalRecord, ClarificationMessage
    from app.models.audit_log import AuditLog
    from app.models.company import Company
    from app.models.department import Department
    from app.models.document import PaymentRequestDocument
    from app.models.notification import Notification
    from app.models.payment_record import PaymentRecord
    from app.models.payment_request import PaymentRequest
    from app.models.role import Role
    from app.models.session import UserSession
    from app.models.settings import SystemSettings


class User(BaseModel):
    """
    User entity representing employees, accountants, approvers, and administrators.
    """
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="Primary login email address (case-insensitive)",
    )
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Bcrypt or Argon2 hashed password string",
    )
    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="User given name",
    )
    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="User family/surname",
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Assigned role determining system permissions",
    )
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Department the user belongs to",
    )
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Company the user is affiliated with",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Flag indicating active account status",
    )
    is_locked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
        comment="Flag indicating security lock due to failed attempts or administrative action",
    )
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Consecutive failed login attempts count",
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp of most recent successful login",
    )
    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether the email address was verified via link or OTP",
    )
    phone: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Contact telephone / mobile number",
    )
    avatar_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="URL pointing to uploaded profile picture",
    )

    # Relationships
    role: Mapped["Role"] = relationship(
        "Role",
        back_populates="users",
    )
    company: Mapped[Optional["Company"]] = relationship(
        "Company",
        back_populates="users",
    )
    department: Mapped[Optional["Department"]] = relationship(
        "Department",
        foreign_keys=[department_id],
        back_populates="users",
    )
    headed_departments: Mapped[List["Department"]] = relationship(
        "Department",
        foreign_keys="Department.head_id",
        back_populates="head",
    )
    requested_payments: Mapped[List["PaymentRequest"]] = relationship(
        "PaymentRequest",
        foreign_keys="PaymentRequest.requested_by_id",
        back_populates="requested_by",
    )
    assigned_approvals: Mapped[List["PaymentRequest"]] = relationship(
        "PaymentRequest",
        foreign_keys="PaymentRequest.assigned_approver_id",
        back_populates="assigned_approver",
    )
    approvals: Mapped[List["ApprovalRecord"]] = relationship(
        "ApprovalRecord",
        foreign_keys="ApprovalRecord.approver_id",
        back_populates="approver",
    )
    clarification_messages: Mapped[List["ClarificationMessage"]] = relationship(
        "ClarificationMessage",
        foreign_keys="ClarificationMessage.sender_id",
        back_populates="sender",
    )
    payment_records: Mapped[List["PaymentRecord"]] = relationship(
        "PaymentRecord",
        foreign_keys="PaymentRecord.paid_by_id",
        back_populates="paid_by",
    )
    uploaded_documents: Mapped[List["PaymentRequestDocument"]] = relationship(
        "PaymentRequestDocument",
        foreign_keys="PaymentRequestDocument.uploaded_by_id",
        back_populates="uploaded_by",
    )
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="user",
    )
    sessions: Mapped[List["UserSession"]] = relationship(
        "UserSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    updated_settings: Mapped[List["SystemSettings"]] = relationship(
        "SystemSettings",
        foreign_keys="SystemSettings.updated_by_id",
        back_populates="updated_by",
    )

    @property
    def full_name(self) -> str:
        """Helper to get full name."""
        return f"{self.first_name} {self.last_name}".strip()

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', name='{self.full_name}')>"

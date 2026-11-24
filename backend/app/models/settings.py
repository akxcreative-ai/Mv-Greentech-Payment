"""
SystemSettings and ApprovalRule models for MV Payment Approval System.
Manages global application configurations and company-specific tiered approval limits.
"""

from decimal import Decimal
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

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.user import User


class SystemSettings(Base, UUIDMixin, TimestampMixin):
    """
    Key-value system-wide configuration parameters (e.g. SMTP config, notification toggles, default limits).
    """
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique configuration key identifier",
    )
    value: Mapped[Any] = mapped_column(
        JSON,
        nullable=False,
        comment="Configuration value stored as JSON (supports strings, numbers, lists, objects)",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Human-readable description of what this setting controls",
    )
    updated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="User who last updated this configuration setting",
    )

    # Relationships
    updated_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[updated_by_id],
        back_populates="updated_settings",
    )

    def __repr__(self) -> str:
        return f"<SystemSettings(id={self.id}, key='{self.key}')>"


class ApprovalRule(Base, UUIDMixin, TimestampMixin):
    """
    Configurable matrix defining amount thresholds and required approver roles per company.
    """
    __tablename__ = "approval_rules"
    __table_args__ = (
        Index("ix_approval_rules_company_amounts", "company_id", "min_amount", "max_amount"),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Company entity to which this rule applies",
    )
    min_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        default=Decimal("0.00"),
        nullable=False,
        comment="Lower monetary threshold for this rule tier",
    )
    max_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2),
        nullable=True,
        comment="Upper monetary threshold for this tier (NULL indicates infinity)",
    )
    requires_approval: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether requests falling in this range require explicit approval",
    )
    approver_role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Required role to approve this threshold (e.g. department_head, accountant, director)",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Active status of this rule",
    )

    # Relationships
    company: Mapped["Company"] = relationship(
        "Company",
        back_populates="approval_rules",
    )

    def __repr__(self) -> str:
        return f"<ApprovalRule(id={self.id}, company_id={self.company_id}, range=[{self.min_amount}, {self.max_amount}], role='{self.approver_role}')>"

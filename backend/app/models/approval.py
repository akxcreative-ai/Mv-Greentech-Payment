"""
Approval and Clarification models for MV Payment Approval System.
Audit trail of approval decisions, amount adjustments, and clarification dialogue.
"""

from decimal import Decimal
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
    from app.models.payment_request import PaymentRequest
    from app.models.user import User


class ApprovalStatus(str, Enum):
    """Status outcomes for an approval action."""
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CLARIFICATION_REQUIRED = "CLARIFICATION_REQUIRED"


class ApprovalRecord(Base, UUIDMixin, TimeCreatedMixin):
    """
    Immutable audit record documenting an approval, rejection, or clarification action.
    """
    __tablename__ = "approval_records"
    __table_args__ = (
        Index("ix_approval_records_request_created", "payment_request_id", "created_at"),
    )

    payment_request_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("payment_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Associated payment request",
    )
    approver_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Approver user who executed this decision",
    )
    status: Mapped[ApprovalStatus] = mapped_column(
        SAEnum(ApprovalStatus, name="approval_status_enum"),
        nullable=False,
        index=True,
        comment="Decision outcome: APPROVED, REJECTED, or CLARIFICATION_REQUIRED",
    )
    comment: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Approver remarks, justification, or reason for decision",
    )
    original_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        nullable=False,
        comment="Original amount submitted on the request at the time of review",
    )
    approved_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2),
        nullable=True,
        comment="Adjusted amount approved (if modified by approver)",
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45),
        nullable=True,
        comment="Client IP address where decision was taken (IPv4/IPv6)",
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Client device / browser user-agent string",
    )

    # Relationships
    payment_request: Mapped["PaymentRequest"] = relationship(
        "PaymentRequest",
        back_populates="approval_records",
    )
    approver: Mapped["User"] = relationship(
        "User",
        foreign_keys=[approver_id],
        back_populates="approvals",
    )

    def __repr__(self) -> str:
        return f"<ApprovalRecord(id={self.id}, request_id={self.payment_request_id}, status='{self.status.value}')>"


class ClarificationMessage(Base, UUIDMixin, TimeCreatedMixin):
    """
    Message thread for queries and answers between approvers and requesters.
    """
    __tablename__ = "clarification_messages"
    __table_args__ = (
        Index("ix_clarification_messages_request_created", "payment_request_id", "created_at"),
    )

    payment_request_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("payment_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Payment request this clarification message relates to",
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="User sending this clarification inquiry or reply",
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Content of the inquiry or clarification explanation",
    )
    is_response: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="False for questions from approver; True for responses from requester",
    )

    # Relationships
    payment_request: Mapped["PaymentRequest"] = relationship(
        "PaymentRequest",
        back_populates="clarification_messages",
    )
    sender: Mapped["User"] = relationship(
        "User",
        foreign_keys=[sender_id],
        back_populates="clarification_messages",
    )

    def __repr__(self) -> str:
        return f"<ClarificationMessage(id={self.id}, request_id={self.payment_request_id}, is_response={self.is_response})>"

"""
PaymentRequest model for MV Payment Approval System.
Core entity tracking end-to-end payment lifecycle, amounts, approvals, and disbursement status.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, List, Optional
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

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.approval import ApprovalRecord, ClarificationMessage
    from app.models.company import Company
    from app.models.department import Department
    from app.models.document import PaymentRequestDocument
    from app.models.payment_record import PaymentRecord
    from app.models.user import User
    from app.models.vendor import Vendor


class ExpenseCategory(str, Enum):
    """Broad categories for payment expense allocation."""
    VENDOR_PAYMENT = "VENDOR_PAYMENT"
    PURCHASE = "PURCHASE"
    RAW_MATERIAL = "RAW_MATERIAL"
    OFFICE_EXPENSES = "OFFICE_EXPENSES"
    EMPLOYEE_REIMBURSEMENT = "EMPLOYEE_REIMBURSEMENT"
    TRAVEL = "TRAVEL"
    TRANSPORT = "TRANSPORT"
    UTILITY_BILLS = "UTILITY_BILLS"
    MAINTENANCE = "MAINTENANCE"
    SALARY_WAGES = "SALARY_WAGES"
    PROFESSIONAL_FEES = "PROFESSIONAL_FEES"
    GOVERNMENT_FEES = "GOVERNMENT_FEES"
    CAPEX = "CAPEX"
    OTHER = "OTHER"


class PaymentMode(str, Enum):
    """Disbursement / transaction payment modes."""
    NEFT = "NEFT"
    RTGS = "RTGS"
    IMPS = "IMPS"
    UPI = "UPI"
    CHEQUE = "CHEQUE"
    CASH = "CASH"
    OTHER = "OTHER"


class PaymentPriority(str, Enum):
    """Urgency level of payment request."""
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


class PaymentStatus(str, Enum):
    """Lifecycle workflow status of the payment request."""
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CLARIFICATION_REQUIRED = "CLARIFICATION_REQUIRED"
    PAYMENT_PROCESSING = "PAYMENT_PROCESSING"
    PAID = "PAID"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    ON_HOLD = "ON_HOLD"
    OVERDUE = "OVERDUE"
    EXPIRED = "EXPIRED"


class PaymentRequest(BaseModel):
    """
    Payment request model representing an invoice or expense submitted for multi-level approval.
    """
    __tablename__ = "payment_requests"
    __table_args__ = (
        Index("ix_payment_requests_company_status", "company_id", "status"),
        Index("ix_payment_requests_department_status", "department_id", "status"),
        Index("ix_payment_requests_vendor_invoice", "vendor_id", "invoice_number"),
        Index("ix_payment_requests_due_date_status", "due_date", "status"),
    )

    request_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Auto-generated unique payment request identifier (e.g. PR-2024-0001)",
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Company entity bearing this expense",
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("departments.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Originating department requesting payment",
    )
    requested_by_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="User who created and submitted this request",
    )
    vendor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("vendors.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Target vendor or supplier to be paid",
    )
    expense_category: Mapped[ExpenseCategory] = mapped_column(
        SAEnum(ExpenseCategory, name="expense_category_enum"),
        nullable=False,
        index=True,
        comment="Category of the expense",
    )
    expense_subcategory: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Sub-classification for detailed reporting",
    )
    payment_purpose: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Detailed business purpose and description of expenditure",
    )
    invoice_number: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Vendor invoice number",
    )
    invoice_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date indicated on the vendor invoice",
    )
    due_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
        comment="Invoice payment deadline",
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        nullable=False,
        comment="Base invoice/request amount excluding GST",
    )
    gst_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        default=Decimal("0.00"),
        nullable=False,
        comment="Tax / GST component",
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        nullable=False,
        index=True,
        comment="Total payout amount (amount + gst_amount)",
    )
    payment_mode: Mapped[PaymentMode] = mapped_column(
        SAEnum(PaymentMode, name="payment_mode_enum"),
        default=PaymentMode.NEFT,
        nullable=False,
        comment="Requested disbursement channel",
    )
    bank_account: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Specific payout bank account / details",
    )
    priority: Mapped[PaymentPriority] = mapped_column(
        SAEnum(PaymentPriority, name="payment_priority_enum"),
        default=PaymentPriority.NORMAL,
        nullable=False,
        index=True,
        comment="Priority level of payment processing",
    )
    remarks: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Special instructions or requester remarks",
    )
    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus, name="payment_status_enum"),
        default=PaymentStatus.DRAFT,
        nullable=False,
        index=True,
        comment="Current approval/payment workflow state",
    )
    assigned_approver_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Current active approver tasked with reviewing this request",
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when request was formally submitted for approval",
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp of final approval",
    )
    rejected_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp of rejection",
    )
    paid_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when payment was executed",
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when payment workflow completed and verified",
    )
    is_duplicate_override: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Flag indicating duplicate invoice warning was reviewed and overridden",
    )
    duplicate_override_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Justification for bypassing potential duplicate invoice check",
    )

    # Relationships
    company: Mapped["Company"] = relationship(
        "Company",
        back_populates="payment_requests",
    )
    department: Mapped["Department"] = relationship(
        "Department",
        back_populates="payment_requests",
    )
    requested_by: Mapped["User"] = relationship(
        "User",
        foreign_keys=[requested_by_id],
        back_populates="requested_payments",
    )
    assigned_approver: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[assigned_approver_id],
        back_populates="assigned_approvals",
    )
    vendor: Mapped[Optional["Vendor"]] = relationship(
        "Vendor",
        back_populates="payment_requests",
    )
    documents: Mapped[List["PaymentRequestDocument"]] = relationship(
        "PaymentRequestDocument",
        back_populates="payment_request",
        cascade="all, delete-orphan",
    )
    approval_records: Mapped[List["ApprovalRecord"]] = relationship(
        "ApprovalRecord",
        back_populates="payment_request",
        cascade="all, delete-orphan",
    )
    clarification_messages: Mapped[List["ClarificationMessage"]] = relationship(
        "ClarificationMessage",
        back_populates="payment_request",
        cascade="all, delete-orphan",
    )
    payment_records: Mapped[List["PaymentRecord"]] = relationship(
        "PaymentRecord",
        back_populates="payment_request",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<PaymentRequest(id={self.id}, request_number='{self.request_number}', status='{self.status.value}', total_amount={self.total_amount})>"

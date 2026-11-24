"""
PaymentRequest Pydantic schemas for MV Payment Approval System.
Core entity schemas handling multi-tier invoice submissions, approvals, updates, and filtering.
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from app.models.payment_request import (
    ExpenseCategory,
    PaymentMode,
    PaymentPriority,
    PaymentStatus,
)
from app.schemas.approval import ApprovalRecordResponse
from app.schemas.common import PaginatedResponse
from app.schemas.company import CompanySummary
from app.schemas.department import DepartmentSummary
from app.schemas.document import PaymentRequestDocumentResponse
from app.schemas.payment_record import PaymentRecordResponse
from app.schemas.user import UserSummary
from app.schemas.vendor import VendorResponse


class PaymentRequestBase(BaseModel):
    """Base fields shared across creation, update, and response models."""
    model_config = ConfigDict(str_strip_whitespace=True, populate_by_name=True)

    company_id: uuid.UUID = Field(
        ...,
        description="Foreign key UUID of the company bearing this expenditure",
    )
    department_id: uuid.UUID = Field(
        ...,
        description="Originating department requesting payment",
    )
    vendor_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Target vendor or supplier UUID (nullable for internal reimbursements)",
    )
    expense_category: ExpenseCategory = Field(
        ...,
        description="Broad categorization of expense (e.g. VENDOR_PAYMENT, PURCHASE, RAW_MATERIAL)",
    )
    expense_subcategory: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Sub-classification for granular reporting",
    )
    payment_purpose: str = Field(
        ...,
        min_length=3,
        description="Detailed business justification and description of expense",
    )
    invoice_number: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Vendor bill or invoice serial reference",
    )
    invoice_date: Optional[datetime] = Field(
        default=None,
        description="Date indicated on the vendor invoice",
    )
    due_date: Optional[datetime] = Field(
        default=None,
        description="Contractual or requested payment deadline",
    )
    amount: Decimal = Field(
        ...,
        gt=Decimal("0.00"),
        decimal_places=2,
        description="Base taxable / request amount excluding GST",
    )
    gst_amount: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        decimal_places=2,
        description="Goods and Services Tax component amount",
    )
    total_amount: Optional[Decimal] = Field(
        default=None,
        gt=Decimal("0.00"),
        decimal_places=2,
        description="Total disbursement amount (calculated as amount + gst_amount if omitted)",
    )
    payment_mode: PaymentMode = Field(
        default=PaymentMode.NEFT,
        description="Preferred disbursement channel: NEFT, RTGS, IMPS, UPI, CHEQUE, CASH",
    )
    bank_account: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Designated beneficiary or payout bank account",
    )
    priority: PaymentPriority = Field(
        default=PaymentPriority.NORMAL,
        description="Priority urgency: LOW, NORMAL, HIGH, URGENT",
    )
    remarks: Optional[str] = Field(
        default=None,
        description="Special instructions, deductions, or requester notes",
    )
    assigned_approver_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Designated approver user UUID tasked with review",
    )


class PaymentRequestCreate(PaymentRequestBase):
    """
    Schema for creating and drafting a new payment request.
    Automatically calculates or verifies total_amount.
    """
    is_duplicate_override: bool = Field(
        default=False,
        description="True if requester explicitly acknowledged and overrode duplicate warning",
    )
    duplicate_override_reason: Optional[str] = Field(
        default=None,
        description="Justification provided when bypassing potential duplicate invoice check",
    )

    @model_validator(mode="after")
    def calculate_and_verify_total(self) -> "PaymentRequestCreate":
        """Compute total_amount from amount and gst_amount or verify consistency."""
        calculated = self.amount + self.gst_amount
        if self.total_amount is None:
            self.total_amount = calculated
        elif abs(self.total_amount - calculated) > Decimal("0.01"):
            raise ValueError(
                f"total_amount ({self.total_amount}) does not match amount ({self.amount}) + gst_amount ({self.gst_amount}) = {calculated}."
            )
        return self


class PaymentRequestUpdate(BaseModel):
    """
    Schema for modifying editable fields of a payment request.
    Only permitted while payment request is in DRAFT status.
    All attributes are optional.
    """
    model_config = ConfigDict(str_strip_whitespace=True, populate_by_name=True)

    company_id: Optional[uuid.UUID] = Field(default=None, description="Updated company UUID")
    department_id: Optional[uuid.UUID] = Field(default=None, description="Updated department UUID")
    vendor_id: Optional[uuid.UUID] = Field(default=None, description="Updated vendor UUID")
    expense_category: Optional[ExpenseCategory] = Field(default=None, description="Updated category")
    expense_subcategory: Optional[str] = Field(default=None, max_length=100)
    payment_purpose: Optional[str] = Field(default=None, min_length=3)
    invoice_number: Optional[str] = Field(default=None, max_length=100)
    invoice_date: Optional[datetime] = Field(default=None)
    due_date: Optional[datetime] = Field(default=None)
    amount: Optional[Decimal] = Field(default=None, gt=Decimal("0.00"), decimal_places=2)
    gst_amount: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"), decimal_places=2)
    total_amount: Optional[Decimal] = Field(default=None, gt=Decimal("0.00"), decimal_places=2)
    payment_mode: Optional[PaymentMode] = Field(default=None)
    bank_account: Optional[str] = Field(default=None, max_length=50)
    priority: Optional[PaymentPriority] = Field(default=None)
    remarks: Optional[str] = Field(default=None)
    assigned_approver_id: Optional[uuid.UUID] = Field(default=None)
    is_duplicate_override: Optional[bool] = Field(default=None)
    duplicate_override_reason: Optional[str] = Field(default=None)

    @model_validator(mode="after")
    def adjust_total_if_both_present(self) -> "PaymentRequestUpdate":
        if self.amount is not None and self.gst_amount is not None:
            calculated = self.amount + self.gst_amount
            if self.total_amount is None:
                self.total_amount = calculated
            elif abs(self.total_amount - calculated) > Decimal("0.01"):
                raise ValueError(
                    f"total_amount ({self.total_amount}) does not match amount + gst_amount = {calculated}."
                )
        return self


class PaymentRequestResponse(BaseModel):
    """
    Complete payment request response schema returned to clients.
    Includes full lifecycle status, timestamps, and nested relations.
    """
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID = Field(..., description="Payment request unique identifier")
    request_number: str = Field(..., description="Unique generated request code (e.g. PR-2024-0001)")
    company_id: uuid.UUID = Field(..., description="Operating company UUID")
    department_id: uuid.UUID = Field(..., description="Originating department UUID")
    requested_by_id: uuid.UUID = Field(..., description="Requester user UUID")
    vendor_id: Optional[uuid.UUID] = Field(default=None, description="Vendor UUID")
    expense_category: ExpenseCategory = Field(..., description="Expense categorization")
    expense_subcategory: Optional[str] = Field(default=None, description="Expense subcategory")
    payment_purpose: str = Field(..., description="Business justification and purpose")
    invoice_number: Optional[str] = Field(default=None, description="Vendor invoice number")
    invoice_date: Optional[datetime] = Field(default=None, description="Invoice issue date")
    due_date: Optional[datetime] = Field(default=None, description="Payment due deadline")
    amount: Decimal = Field(..., description="Base invoice amount")
    gst_amount: Decimal = Field(..., description="GST tax component")
    total_amount: Decimal = Field(..., description="Total disbursement amount")
    payment_mode: PaymentMode = Field(..., description="Disbursement payment mode")
    bank_account: Optional[str] = Field(default=None, description="Target bank account")
    priority: PaymentPriority = Field(..., description="Processing priority level")
    remarks: Optional[str] = Field(default=None, description="Requester or general remarks")
    status: PaymentStatus = Field(..., description="Current lifecycle state (e.g. DRAFT, PENDING_APPROVAL, APPROVED)")
    assigned_approver_id: Optional[uuid.UUID] = Field(default=None, description="Assigned approver UUID")
    submitted_at: Optional[datetime] = Field(default=None, description="Submission timestamp")
    approved_at: Optional[datetime] = Field(default=None, description="Final approval timestamp")
    rejected_at: Optional[datetime] = Field(default=None, description="Rejection timestamp")
    paid_at: Optional[datetime] = Field(default=None, description="Disbursement timestamp")
    completed_at: Optional[datetime] = Field(default=None, description="Completion timestamp")
    is_duplicate_override: bool = Field(default=False, description="Duplicate check override flag")
    duplicate_override_reason: Optional[str] = Field(default=None, description="Override justification")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Last modification timestamp")

    # Nested related models
    company: Optional[CompanySummary] = Field(default=None, description="Parent company summary")
    department: Optional[DepartmentSummary] = Field(default=None, description="Requesting department summary")
    requested_by: Optional[UserSummary] = Field(default=None, description="Requester user details")
    assigned_approver: Optional[UserSummary] = Field(default=None, description="Assigned approver user details")
    vendor: Optional[VendorResponse] = Field(default=None, description="Associated vendor details")
    documents: List[PaymentRequestDocumentResponse] = Field(default_factory=list, description="Uploaded attachments")
    approval_records: List[ApprovalRecordResponse] = Field(default_factory=list, description="Approval history")
    payment_records: List[PaymentRecordResponse] = Field(default_factory=list, description="Disbursement execution records")

    @computed_field
    @property
    def requester(self) -> Optional[UserSummary]:
        """Alias property returning requested_by for frontend convenience."""
        return self.requested_by

    @computed_field
    @property
    def approver(self) -> Optional[UserSummary]:
        """Alias property returning assigned_approver for frontend convenience."""
        return self.assigned_approver


class PaymentRequestFilter(BaseModel):
    """
    Search and filter criteria parameters for querying payment requests.
    """
    model_config = ConfigDict(str_strip_whitespace=True, populate_by_name=True)

    status: Optional[PaymentStatus] = Field(default=None, description="Filter by workflow status")
    company_id: Optional[uuid.UUID] = Field(default=None, description="Filter by company")
    department_id: Optional[uuid.UUID] = Field(default=None, description="Filter by department")
    vendor_id: Optional[uuid.UUID] = Field(default=None, description="Filter by vendor")
    category: Optional[ExpenseCategory] = Field(
        default=None,
        alias="expense_category",
        description="Filter by expense category",
    )
    priority: Optional[PaymentPriority] = Field(default=None, description="Filter by priority level")
    date_from: Optional[datetime] = Field(default=None, description="Filter created/due on or after this timestamp")
    date_to: Optional[datetime] = Field(default=None, description="Filter created/due on or before this timestamp")
    amount_min: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"), description="Minimum total amount")
    amount_max: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"), description="Maximum total amount")
    search: Optional[str] = Field(default=None, description="Search term matching request number, purpose, or invoice")
    requester_id: Optional[uuid.UUID] = Field(default=None, description="Filter by requester user UUID")
    assigned_approver_id: Optional[uuid.UUID] = Field(default=None, description="Filter by assigned approver UUID")


class PaymentRequestListResponse(PaginatedResponse[PaymentRequestResponse]):
    """Paginated collection of payment requests."""
    pass

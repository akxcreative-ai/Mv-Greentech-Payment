"""
Dashboard and Reporting Pydantic schemas for MV Payment Approval System.
Provides aggregate metrics, role-specific KPI dashboards, time-series projections, and report filters.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.models.payment_request import ExpenseCategory, PaymentStatus


class MonthlyDataPoint(BaseModel):
    """
    Monthly aggregate data point for spending trends and invoice throughput.
    """
    model_config = ConfigDict(from_attributes=True)

    month: str = Field(..., description="Month label (e.g. '2024-01' or 'January')")
    total_requests: int = Field(default=0, ge=0, description="Count of requests submitted")
    total_amount: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), decimal_places=2, description="Total requested sum")
    approved_amount: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), decimal_places=2, description="Total approved sum")
    paid_amount: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), decimal_places=2, description="Total disbursed sum")


class CategorySpendItem(BaseModel):
    """Category-level spend distribution."""
    model_config = ConfigDict(from_attributes=True)

    category: ExpenseCategory = Field(..., description="Expense category")
    count: int = Field(default=0, ge=0, description="Total invoices in category")
    total_amount: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), decimal_places=2, description="Category sum")


class AdminDashboardStats(BaseModel):
    """
    Enterprise-wide operational statistics tailored for Super Admins and Executive Directors.
    """
    model_config = ConfigDict(from_attributes=True)

    total_requests: int = Field(default=0, ge=0, description="Total count of payment requests")
    pending_approval: int = Field(default=0, ge=0, description="Requests currently awaiting review")
    approved_today: int = Field(default=0, ge=0, description="Requests approved in the current calendar day")
    rejected: int = Field(default=0, ge=0, description="Total rejected requests count")
    total_amount: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), decimal_places=2, description="Total monetary sum across all requests")
    payment_pending: int = Field(default=0, ge=0, description="Approved requests awaiting payment disbursement")
    completed: int = Field(default=0, ge=0, description="Fully executed and closed payment requests")
    overdue: int = Field(default=0, ge=0, description="Requests past their scheduled due date")
    monthly_data: List[Union[MonthlyDataPoint, Dict[str, Any]]] = Field(
        default_factory=list,
        description="Chronological monthly transaction aggregates for visualization charts",
    )


class ApproverDashboardStats(BaseModel):
    """
    Queue and decision statistics tailored for Approvers (Department Heads and Directors).
    """
    model_config = ConfigDict(from_attributes=True)

    pending_approval: int = Field(default=0, ge=0, description="Requests assigned to the approver awaiting decision")
    approved_today: int = Field(default=0, ge=0, description="Decisions approved today by this approver")
    rejected: int = Field(default=0, ge=0, description="Total requests rejected by this approver")
    total_approved_amount: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), decimal_places=2, description="Monetary total approved by this approver")
    awaiting_payment: int = Field(default=0, ge=0, description="Requests approved by this user now awaiting disbursement")
    completed: int = Field(default=0, ge=0, description="Approved requests that have completed disbursement")
    overdue: int = Field(default=0, ge=0, description="Pending approval requests that have breached payment due date")


class AccountantDashboardStats(BaseModel):
    """
    Execution workflow statistics tailored for Accountants and Finance Officers.
    """
    model_config = ConfigDict(from_attributes=True)

    my_requests: int = Field(default=0, ge=0, description="Total requests initiated by this user")
    drafts: int = Field(default=0, ge=0, description="Unsubmitted draft requests")
    submitted: int = Field(default=0, ge=0, description="Requests submitted and in flight")
    pending_clarification: int = Field(default=0, ge=0, description="Requests where approver requested clarification")
    approved: int = Field(default=0, ge=0, description="Approved requests ready for payment execution")
    payment_processing: int = Field(default=0, ge=0, description="Payments currently being processed")
    completed: int = Field(default=0, ge=0, description="Successfully disbursed and verified payments")


class ReportFilter(BaseModel):
    """
    Comprehensive query filter criteria for generating operational and financial reports.
    """
    model_config = ConfigDict(str_strip_whitespace=True, populate_by_name=True)

    date_from: Optional[datetime] = Field(default=None, description="Start date for reporting window")
    date_to: Optional[datetime] = Field(default=None, description="End date for reporting window")
    company_id: Optional[uuid.UUID] = Field(default=None, description="Filter by company UUID")
    department_id: Optional[uuid.UUID] = Field(default=None, description="Filter by department UUID")
    vendor_id: Optional[uuid.UUID] = Field(default=None, description="Filter by vendor UUID")
    status: Optional[PaymentStatus] = Field(default=None, description="Filter by payment status")
    category: Optional[ExpenseCategory] = Field(
        default=None,
        alias="expense_category",
        description="Filter by expense category",
    )
    requester_id: Optional[uuid.UUID] = Field(default=None, description="Filter by requesting user UUID")
    approver_id: Optional[uuid.UUID] = Field(default=None, description="Filter by assigned/decision approver UUID")

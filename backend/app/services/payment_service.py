"""
Payment Request Management Service for MV Payment Approval System.

Handles end-to-end payment request lifecycle: creation, duplicate invoice detection,
threshold checks, approval routing, document attachments, and critical re-approval resets.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import logging
import math
import os
from pathlib import Path
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union
import uuid

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.approval import ApprovalRecord, ClarificationMessage
from app.models.audit_log import AuditEventType
from app.models.company import Company
from app.models.department import Department
from app.models.document import PaymentRequestDocument
from app.models.notification import NotificationType
from app.models.payment_record import PaymentRecord
from app.models.payment_request import (
    ExpenseCategory,
    PaymentMode,
    PaymentPriority,
    PaymentRequest,
    PaymentStatus,
)
from app.models.role import Role, RoleEnum
from app.models.settings import ApprovalRule
from app.models.user import User
from app.models.vendor import Vendor
from app.services.audit_service import log_event
from app.services.notification_service import create_notification
from app.services.settings_service import get_applicable_rule
from app.services.user_service import get_approvers
from app.utils.email import send_approval_notification
from app.utils.file_handler import delete_file, save_upload
from app.utils.security import validate_file_upload

logger = logging.getLogger(__name__)

T = TypeVar("T")

try:
    from app.schemas.common import PaginatedResponse
except ImportError:
    try:
        from app.schemas import PaginatedResponse
    except ImportError:

        class PaginatedResponse(BaseModel, Generic[T]):  # type: ignore
            items: List[T]
            total: int
            page: int
            page_size: int
            total_pages: int
            has_next: bool
            has_prev: bool

            class Config:
                arbitrary_types_allowed = True


def _extract_dict(data: Any) -> Dict[str, Any]:
    """Helper to convert Pydantic models or dicts to a standard dictionary."""
    if isinstance(data, dict):
        return data
    if hasattr(data, "model_dump"):
        return data.model_dump(exclude_unset=True)
    if hasattr(data, "dict"):
        return data.dict(exclude_unset=True)
    return dict(data)


async def generate_request_number(db: AsyncSession) -> str:
    """
    Generates a standardized, unique sequential payment request number.
    Format: PR-YYYY-NNNN (e.g. PR-2026-0001).

    Args:
        db: Active AsyncSession database session.

    Returns:
        Unique reference string.
    """
    current_year = datetime.now(timezone.utc).year
    prefix = f"PR-{current_year}-"

    # Count existing payment requests with prefix for current year
    stmt = (
        select(func.count())
        .select_from(PaymentRequest)
        .where(PaymentRequest.request_number.like(f"{prefix}%"))
    )
    result = await db.execute(stmt)
    count = result.scalar_one_or_none() or 0

    sequence = count + 1
    candidate = f"{prefix}{sequence:04d}"

    # Verify uniqueness in case of race conditions or gaps
    while True:
        stmt_check = select(PaymentRequest.id).where(PaymentRequest.request_number == candidate)
        res_check = await db.execute(stmt_check)
        if res_check.scalar_one_or_none() is None:
            return candidate
        sequence += 1
        candidate = f"{prefix}{sequence:04d}"


async def check_duplicate(
    vendor_id: Optional[Union[uuid.UUID, str]],
    invoice_number: Optional[str],
    invoice_date: Optional[Union[datetime, str]],
    amount: Union[Decimal, float, int],
    company_id: Union[uuid.UUID, str],
    db: AsyncSession,
    exclude_request_id: Optional[Union[uuid.UUID, str]] = None,
) -> List[PaymentRequest]:
    """
    Checks for potential duplicate payment requests in the database.
    Detects identical (company, vendor, invoice_number) or matching (vendor, amount, date +- 30 days).

    Args:
        vendor_id: Vendor UUID.
        invoice_number: Invoice number string.
        invoice_date: Stated vendor invoice date.
        amount: Payment invoice amount.
        company_id: Company UUID.
        db: Active AsyncSession database session.
        exclude_request_id: Optional ID to exclude from duplicate search (for updates).

    Returns:
        List of matching potential duplicate PaymentRequest instances.
    """
    if not vendor_id:
        return []

    parsed_vid = vendor_id if isinstance(vendor_id, uuid.UUID) else uuid.UUID(str(vendor_id))
    parsed_cid = company_id if isinstance(company_id, uuid.UUID) else uuid.UUID(str(company_id))
    dec_amount = Decimal(str(amount))

    parsed_exclude: Optional[uuid.UUID] = None
    if exclude_request_id:
        parsed_exclude = (
            exclude_request_id
            if isinstance(exclude_request_id, uuid.UUID)
            else uuid.UUID(str(exclude_request_id))
        )

    # Base conditions: active, non-cancelled requests in this company
    base_conds = [
        PaymentRequest.is_deleted.is_(False),
        PaymentRequest.status != PaymentStatus.CANCELLED,
    ]
    if parsed_exclude:
        base_conds.append(PaymentRequest.id != parsed_exclude)

    duplicate_conditions = []

    # Condition 1: Same company, same vendor, and same invoice number
    if invoice_number and str(invoice_number).strip():
        clean_inv = str(invoice_number).strip().lower()
        duplicate_conditions.append(
            (PaymentRequest.company_id == parsed_cid)
            & (PaymentRequest.vendor_id == parsed_vid)
            & (func.lower(PaymentRequest.invoice_number) == clean_inv)
        )

    # Condition 2: Same vendor, exact same amount, and invoice_date within 30 days
    if invoice_date:
        parsed_date: datetime
        if isinstance(invoice_date, str):
            parsed_date = datetime.fromisoformat(invoice_date)
        else:
            parsed_date = invoice_date

        start_window = parsed_date - timedelta(days=30)
        end_window = parsed_date + timedelta(days=30)

        duplicate_conditions.append(
            (PaymentRequest.vendor_id == parsed_vid)
            & (PaymentRequest.amount == dec_amount)
            & (PaymentRequest.invoice_date >= start_window)
            & (PaymentRequest.invoice_date <= end_window)
        )

    if not duplicate_conditions:
        return []

    stmt = (
        select(PaymentRequest)
        .where(*base_conds, or_(*duplicate_conditions))
        .order_by(PaymentRequest.created_at.desc())
        .limit(10)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_payment_request(
    data: Union[Dict[str, Any], Any],
    user_id: Union[uuid.UUID, str],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> PaymentRequest:
    """
    Creates a new payment request in DRAFT status.

    Args:
        data: Payment request fields (company_id, department_id, amount, vendor_id, etc.).
        user_id: Requester User UUID.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The newly created PaymentRequest model instance.

    Raises:
        HTTPException: 400 Bad Request on missing mandatory fields or invalid company/department.
    """
    payload = _extract_dict(data)
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

    # Validate company_id
    raw_company_id = payload.get("company_id")
    if not raw_company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company ID is required.",
        )
    parsed_company_id = (
        raw_company_id if isinstance(raw_company_id, uuid.UUID) else uuid.UUID(str(raw_company_id))
    )
    company = await db.get(Company, parsed_company_id)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID '{parsed_company_id}' not found.",
        )

    # Validate department_id
    raw_dept_id = payload.get("department_id")
    if not raw_dept_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Department ID is required.",
        )
    parsed_dept_id = (
        raw_dept_id if isinstance(raw_dept_id, uuid.UUID) else uuid.UUID(str(raw_dept_id))
    )
    dept = await db.get(Department, parsed_dept_id)
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID '{parsed_dept_id}' not found.",
        )

    # Validate vendor_id if provided
    parsed_vendor_id: Optional[uuid.UUID] = None
    if payload.get("vendor_id"):
        vid = payload["vendor_id"]
        parsed_vendor_id = vid if isinstance(vid, uuid.UUID) else uuid.UUID(str(vid))
        vendor = await db.get(Vendor, parsed_vendor_id)
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vendor with ID '{parsed_vendor_id}' not found.",
            )

    # Validate amount
    raw_amount = payload.get("amount")
    if raw_amount is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount is required.",
        )
    amount = Decimal(str(raw_amount))
    if amount <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount must be greater than zero.",
        )

    gst_amount = Decimal(str(payload.get("gst_amount", "0.00")))
    total_amount = amount + gst_amount

    # Validate expense category
    raw_category = payload.get("expense_category", ExpenseCategory.VENDOR_PAYMENT.value)
    expense_category: ExpenseCategory
    if isinstance(raw_category, ExpenseCategory):
        expense_category = raw_category
    else:
        try:
            expense_category = ExpenseCategory(str(raw_category).upper())
        except ValueError:
            expense_category = ExpenseCategory.OTHER

    # Validate payment mode
    raw_mode = payload.get("payment_mode", PaymentMode.NEFT.value)
    payment_mode: PaymentMode
    if isinstance(raw_mode, PaymentMode):
        payment_mode = raw_mode
    else:
        try:
            payment_mode = PaymentMode(str(raw_mode).upper())
        except ValueError:
            payment_mode = PaymentMode.NEFT

    # Validate priority
    raw_priority = payload.get("priority", PaymentPriority.NORMAL.value)
    priority: PaymentPriority
    if isinstance(raw_priority, PaymentPriority):
        priority = raw_priority
    else:
        try:
            priority = PaymentPriority(str(raw_priority).upper())
        except ValueError:
            priority = PaymentPriority.NORMAL

    # Dates
    invoice_date: Optional[datetime] = None
    if payload.get("invoice_date"):
        dt = payload["invoice_date"]
        invoice_date = datetime.fromisoformat(dt) if isinstance(dt, str) else dt

    due_date: Optional[datetime] = None
    if payload.get("due_date"):
        dt = payload["due_date"]
        due_date = datetime.fromisoformat(dt) if isinstance(dt, str) else dt

    # Check potential duplicate invoices
    invoice_num = str(payload.get("invoice_number", "")).strip() or None
    duplicates = await check_duplicate(
        vendor_id=parsed_vendor_id,
        invoice_number=invoice_num,
        invoice_date=invoice_date,
        amount=amount,
        company_id=parsed_company_id,
        db=db,
    )
    is_duplicate_override = False
    duplicate_override_reason = None
    if duplicates:
        if not payload.get("is_duplicate_override"):
            logger.warning(
                "Potential duplicate detected for invoice '%s' amount %s: %s matches.",
                invoice_num,
                amount,
                len(duplicates),
            )
        else:
            is_duplicate_override = True
            duplicate_override_reason = str(
                payload.get("duplicate_override_reason", "User reviewed duplicate warning")
            ).strip()

    request_number = await generate_request_number(db)

    req = PaymentRequest(
        request_number=request_number,
        company_id=parsed_company_id,
        department_id=parsed_dept_id,
        requested_by_id=parsed_user_id,
        vendor_id=parsed_vendor_id,
        expense_category=expense_category,
        expense_subcategory=str(payload["expense_subcategory"]).strip()
        if payload.get("expense_subcategory")
        else None,
        payment_purpose=str(payload.get("payment_purpose", "")).strip(),
        invoice_number=invoice_num,
        invoice_date=invoice_date,
        due_date=due_date,
        amount=amount,
        gst_amount=gst_amount,
        total_amount=total_amount,
        payment_mode=payment_mode,
        bank_account=str(payload["bank_account"]).strip() if payload.get("bank_account") else None,
        priority=priority,
        remarks=str(payload["remarks"]).strip() if payload.get("remarks") else None,
        status=PaymentStatus.DRAFT,
        is_duplicate_override=is_duplicate_override,
        duplicate_override_reason=duplicate_override_reason,
    )

    db.add(req)
    await db.flush()

    await log_event(
        user_id=parsed_user_id,
        event_type=AuditEventType.PAYMENT_REQUEST_CREATED,
        entity_type="payment_request",
        entity_id=req.id,
        previous_value=None,
        new_value={
            "request_number": req.request_number,
            "total_amount": float(req.total_amount),
            "status": req.status.value,
        },
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return req


async def update_payment_request(
    request_id: Union[uuid.UUID, str],
    data: Union[Dict[str, Any], Any],
    user_id: Union[uuid.UUID, str],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> PaymentRequest:
    """
    Updates a payment request.
    If request is in DRAFT status: allows updating fields.
    CRITICAL: When updating an APPROVED request's critical fields (vendor, amount, invoice, company, purpose),
    resets status to PENDING_APPROVAL and re-routes for approval.

    Args:
        request_id: Target PaymentRequest UUID.
        data: Updated fields dictionary or schema.
        user_id: Requesting User UUID.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The updated PaymentRequest model instance.

    Raises:
        HTTPException: 404 Not Found, 400 Bad Request on invalid state transitions.
    """
    parsed_id = request_id if isinstance(request_id, uuid.UUID) else uuid.UUID(str(request_id))
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
    payload = _extract_dict(data)

    stmt = select(PaymentRequest).where(
        PaymentRequest.id == parsed_id,
        PaymentRequest.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    req = result.scalar_one_or_none()

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PaymentRequest with ID '{parsed_id}' not found.",
        )

    # Validate allowable states
    allowed_states = {
        PaymentStatus.DRAFT,
        PaymentStatus.APPROVED,
        PaymentStatus.CLARIFICATION_REQUIRED,
        PaymentStatus.REJECTED,
    }
    if req.status not in allowed_states:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update payment request currently in '{req.status.value}' status.",
        )

    previous_value = {
        "status": req.status.value,
        "amount": float(req.amount),
        "gst_amount": float(req.gst_amount),
        "total_amount": float(req.total_amount),
        "vendor_id": str(req.vendor_id) if req.vendor_id else None,
        "invoice_number": req.invoice_number,
        "payment_purpose": req.payment_purpose,
        "company_id": str(req.company_id),
    }

    # Check whether critical fields are being modified
    critical_fields_changed = False

    if "vendor_id" in payload:
        new_vid = (
            uuid.UUID(str(payload["vendor_id"]))
            if payload["vendor_id"]
            else None
        )
        if new_vid != req.vendor_id:
            critical_fields_changed = True
            req.vendor_id = new_vid

    if "company_id" in payload and payload["company_id"]:
        new_cid = (
            payload["company_id"]
            if isinstance(payload["company_id"], uuid.UUID)
            else uuid.UUID(str(payload["company_id"]))
        )
        if new_cid != req.company_id:
            critical_fields_changed = True
            req.company_id = new_cid

    if "invoice_number" in payload:
        new_inv = str(payload["invoice_number"]).strip() if payload["invoice_number"] else None
        if new_inv != req.invoice_number:
            critical_fields_changed = True
            req.invoice_number = new_inv

    if "payment_purpose" in payload and payload["payment_purpose"]:
        new_purpose = str(payload["payment_purpose"]).strip()
        if new_purpose != req.payment_purpose:
            critical_fields_changed = True
            req.payment_purpose = new_purpose

    # Recalculate amount if changed
    amount_changed = False
    if "amount" in payload and payload["amount"] is not None:
        new_amount = Decimal(str(payload["amount"]))
        if new_amount != req.amount:
            req.amount = new_amount
            amount_changed = True
            critical_fields_changed = True

    if "gst_amount" in payload and payload["gst_amount"] is not None:
        new_gst = Decimal(str(payload["gst_amount"]))
        if new_gst != req.gst_amount:
            req.gst_amount = new_gst
            amount_changed = True
            critical_fields_changed = True

    if amount_changed:
        req.total_amount = req.amount + req.gst_amount

    # Update non-critical fields
    if "department_id" in payload and payload["department_id"]:
        req.department_id = (
            payload["department_id"]
            if isinstance(payload["department_id"], uuid.UUID)
            else uuid.UUID(str(payload["department_id"]))
        )

    if "expense_category" in payload and payload["expense_category"]:
        cat = payload["expense_category"]
        req.expense_category = (
            cat if isinstance(cat, ExpenseCategory) else ExpenseCategory(str(cat).upper())
        )

    if "expense_subcategory" in payload:
        req.expense_subcategory = (
            str(payload["expense_subcategory"]).strip() if payload["expense_subcategory"] else None
        )

    if "payment_mode" in payload and payload["payment_mode"]:
        pmode = payload["payment_mode"]
        req.payment_mode = (
            pmode if isinstance(pmode, PaymentMode) else PaymentMode(str(pmode).upper())
        )

    if "priority" in payload and payload["priority"]:
        prio = payload["priority"]
        req.priority = prio if isinstance(prio, PaymentPriority) else PaymentPriority(str(prio).upper())

    if "remarks" in payload:
        req.remarks = str(payload["remarks"]).strip() if payload["remarks"] else None

    if "bank_account" in payload:
        req.bank_account = str(payload["bank_account"]).strip() if payload["bank_account"] else None

    # CRITICAL RULE: If request was APPROVED and critical fields changed, require re-approval!
    was_approved = req.status == PaymentStatus.APPROVED
    if was_approved and critical_fields_changed:
        logger.warning(
            "PaymentRequest #%s critical fields modified after approval; resetting status to PENDING_APPROVAL.",
            req.request_number,
        )
        req.status = PaymentStatus.PENDING_APPROVAL
        req.approved_at = None
        # Check rule and reassign approver
        rule = await get_applicable_rule(req.company_id, req.total_amount, db)
        approvers = await get_approvers(req.company_id, db)
        eligible = [a for a in approvers if a.id != req.requested_by_id]
        if eligible:
            req.assigned_approver_id = eligible[0].id
            await create_notification(
                user_id=req.assigned_approver_id,
                title=f"Re-Approval Required: {req.request_number}",
                message=f"Payment request #{req.request_number} critical details were amended after approval and require re-approval.",
                type=NotificationType.REMINDER,
                entity_type="payment_request",
                entity_id=req.id,
                db=db,
            )

    new_value = {
        "status": req.status.value,
        "amount": float(req.amount),
        "gst_amount": float(req.gst_amount),
        "total_amount": float(req.total_amount),
        "vendor_id": str(req.vendor_id) if req.vendor_id else None,
        "invoice_number": req.invoice_number,
        "payment_purpose": req.payment_purpose,
        "re_approval_triggered": was_approved and critical_fields_changed,
    }

    await db.flush()

    await log_event(
        user_id=parsed_user_id,
        event_type=AuditEventType.PAYMENT_REQUEST_UPDATED,
        entity_type="payment_request",
        entity_id=req.id,
        previous_value=previous_value,
        new_value=new_value,
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return req


async def submit_payment_request(
    request_id: Union[uuid.UUID, str],
    user_id: Union[uuid.UUID, str],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> PaymentRequest:
    """
    Submits a payment request for approval.
    CRITICAL: Evaluates threshold limits. The request CANNOT skip approval.
    Enforces Separation of Duties: Approver CANNOT approve their own request.
    Assigns appropriate authorized approver and updates status to PENDING_APPROVAL.

    Args:
        request_id: PaymentRequest UUID.
        user_id: Submitting User UUID.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The submitted PaymentRequest model instance.

    Raises:
        HTTPException: 400 Bad Request if request cannot be submitted or approver not found.
    """
    parsed_id = request_id if isinstance(request_id, uuid.UUID) else uuid.UUID(str(request_id))
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

    stmt = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.company),
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.vendor),
        )
        .where(
            PaymentRequest.id == parsed_id,
            PaymentRequest.is_deleted.is_(False),
        )
    )
    result = await db.execute(stmt)
    req = result.scalar_one_or_none()

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PaymentRequest with ID '{parsed_id}' not found.",
        )

    # Must be DRAFT, REJECTED, or CLARIFICATION_REQUIRED
    submittable_statuses = {
        PaymentStatus.DRAFT,
        PaymentStatus.REJECTED,
        PaymentStatus.CLARIFICATION_REQUIRED,
    }
    if req.status not in submittable_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit request with status '{req.status.value}'. Must be in DRAFT, REJECTED, or CLARIFICATION_REQUIRED.",
        )

    # 1. Evaluate tiered approval rule for threshold
    rule = await get_applicable_rule(req.company_id, req.total_amount, db)

    # 2. Determine target approver role
    target_role_name = rule.approver_role if rule else "department_head"

    # 3. Find eligible approver respecting Separation of Duties (requested_by_id != approver_id)
    assigned_approver: Optional[User] = None

    if target_role_name == "department_head":
        # Check department head
        dept = await db.get(Department, req.department_id)
        if dept and dept.head_id and dept.head_id != req.requested_by_id:
            assigned_approver = await db.get(User, dept.head_id)

    if not assigned_approver:
        # Fallback to Directors in the company
        approvers = await get_approvers(req.company_id, db)
        # Filter: cannot be requester, prioritize director, then department_head, then accountant, then super_admin
        eligible = [a for a in approvers if a.id != req.requested_by_id and a.is_active]

        directors = [a for a in eligible if a.role and a.role.name == RoleEnum.DIRECTOR.value]
        if directors:
            assigned_approver = directors[0]
        else:
            # Any eligible approver
            if eligible:
                assigned_approver = eligible[0]

    if not assigned_approver:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No eligible approver found for this company and threshold tier. "
                "Per anti-fraud Separation of Duties policy, a requester cannot self-approve."
            ),
        )

    # CRITICAL: Status MUST BE PENDING_APPROVAL. Request CANNOT skip approval.
    req.status = PaymentStatus.PENDING_APPROVAL
    req.assigned_approver_id = assigned_approver.id
    req.submitted_at = datetime.now(timezone.utc)

    await db.flush()

    # Create in-app notification for assigned approver
    await create_notification(
        user_id=assigned_approver.id,
        title=f"New Payment Request Awaiting Approval: #{req.request_number}",
        message=(
            f"Payment Request #{req.request_number} for {req.total_amount} "
            f"has been submitted by {req.requested_by.full_name if req.requested_by else 'User'}."
        ),
        type=NotificationType.PAYMENT_SUBMITTED,
        entity_type="payment_request",
        entity_id=req.id,
        db=db,
    )

    # Send async email notification to assigned approver
    try:
        await send_approval_notification(req, assigned_approver)
    except Exception as exc:
        logger.error("Failed to send approval email for request %s: %s", req.request_number, exc)

    await log_event(
        user_id=parsed_user_id,
        event_type=AuditEventType.PAYMENT_REQUEST_SUBMITTED,
        entity_type="payment_request",
        entity_id=req.id,
        previous_value={"status": PaymentStatus.DRAFT.value},
        new_value={
            "status": PaymentStatus.PENDING_APPROVAL.value,
            "assigned_approver_id": str(assigned_approver.id),
            "amount": float(req.total_amount),
        },
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return req


async def get_payment_request(
    request_id: Union[uuid.UUID, str],
    user_id: Union[uuid.UUID, str],
    db: AsyncSession,
) -> PaymentRequest:
    """
    Retrieves full payment request details including approval records, documents, and messages.

    Args:
        request_id: Target PaymentRequest UUID.
        user_id: Requesting User UUID.
        db: Active AsyncSession database session.

    Returns:
        PaymentRequest model instance.

    Raises:
        HTTPException: 404 Not Found if request does not exist or is deleted.
    """
    parsed_id = request_id if isinstance(request_id, uuid.UUID) else uuid.UUID(str(request_id))

    stmt = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.company),
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
            selectinload(PaymentRequest.vendor),
            selectinload(PaymentRequest.documents).selectinload(PaymentRequestDocument.uploaded_by),
            selectinload(PaymentRequest.approval_records).selectinload(ApprovalRecord.approver),
            selectinload(PaymentRequest.clarification_messages).selectinload(ClarificationMessage.sender),
            selectinload(PaymentRequest.payment_records).selectinload(PaymentRecord.paid_by),
        )
        .where(
            PaymentRequest.id == parsed_id,
            PaymentRequest.is_deleted.is_(False),
        )
    )
    result = await db.execute(stmt)
    req = result.scalar_one_or_none()

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PaymentRequest with ID '{parsed_id}' not found.",
        )

    return req


async def list_payment_requests(
    filters: Optional[Union[Dict[str, Any], Any]],
    pagination: Optional[Union[Dict[str, Any], Any]],
    user_id: Union[uuid.UUID, str],
    role: Union[str, RoleEnum],
    db: AsyncSession,
) -> PaginatedResponse[PaymentRequest]:
    """
    Lists payment requests filtered by user role permissions, metadata, and pagination.

    Role scoping rules:
    - Super Admin: sees all across companies
    - Director / Accountant: sees all requests in their company
    - Department Head: sees department requests, requests assigned to them, and requests they created
    - Requester: sees requests they created

    Args:
        filters: Filter criteria dictionary or schema.
        pagination: Pagination dictionary or schema.
        user_id: User UUID asserting request.
        role: User role name or enum.
        db: Active AsyncSession database session.

    Returns:
        PaginatedResponse of PaymentRequest records.
    """
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
    role_str = role.value.lower() if isinstance(role, RoleEnum) else str(role).lower()

    page = 1
    page_size = 20
    if pagination:
        if isinstance(pagination, dict):
            page = int(pagination.get("page", 1))
            page_size = int(pagination.get("page_size", pagination.get("limit", 20)))
        else:
            page = getattr(pagination, "page", 1)
            page_size = getattr(pagination, "page_size", getattr(pagination, "limit", 20))

    page = max(1, page)
    page_size = max(1, min(page_size, 100))

    query = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.company),
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
            selectinload(PaymentRequest.vendor),
        )
        .where(PaymentRequest.is_deleted.is_(False))
    )
    count_query = select(func.count()).select_from(PaymentRequest).where(PaymentRequest.is_deleted.is_(False))

    # Apply role-based scoping
    curr_user = await db.get(User, parsed_user_id)
    if role_str == RoleEnum.SUPER_ADMIN.value:
        pass  # sees all
    elif role_str in (RoleEnum.DIRECTOR.value, RoleEnum.ACCOUNTANT.value):
        if curr_user and curr_user.company_id:
            query = query.where(PaymentRequest.company_id == curr_user.company_id)
            count_query = count_query.where(PaymentRequest.company_id == curr_user.company_id)
    elif role_str == RoleEnum.DEPARTMENT_HEAD.value:
        conditions = [PaymentRequest.requested_by_id == parsed_user_id]
        if curr_user and curr_user.department_id:
            conditions.append(PaymentRequest.department_id == curr_user.department_id)
        conditions.append(PaymentRequest.assigned_approver_id == parsed_user_id)
        query = query.where(or_(*conditions))
        count_query = count_query.where(or_(*conditions))
    else:
        # Standard employee
        query = query.where(PaymentRequest.requested_by_id == parsed_user_id)
        count_query = count_query.where(PaymentRequest.requested_by_id == parsed_user_id)

    # Apply explicit user filters
    if filters:
        f = _extract_dict(filters)

        if f.get("status"):
            st = f["status"]
            parsed_st = st if isinstance(st, PaymentStatus) else PaymentStatus(str(st).upper())
            query = query.where(PaymentRequest.status == parsed_st)
            count_query = count_query.where(PaymentRequest.status == parsed_st)

        if f.get("company_id"):
            cid = f["company_id"]
            parsed_cid = cid if isinstance(cid, uuid.UUID) else uuid.UUID(str(cid))
            query = query.where(PaymentRequest.company_id == parsed_cid)
            count_query = count_query.where(PaymentRequest.company_id == parsed_cid)

        if f.get("department_id"):
            did = f["department_id"]
            parsed_did = did if isinstance(did, uuid.UUID) else uuid.UUID(str(did))
            query = query.where(PaymentRequest.department_id == parsed_did)
            count_query = count_query.where(PaymentRequest.department_id == parsed_did)

        if f.get("vendor_id"):
            vid = f["vendor_id"]
            parsed_vid = vid if isinstance(vid, uuid.UUID) else uuid.UUID(str(vid))
            query = query.where(PaymentRequest.vendor_id == parsed_vid)
            count_query = count_query.where(PaymentRequest.vendor_id == parsed_vid)

        if f.get("priority"):
            prio = f["priority"]
            parsed_prio = prio if isinstance(prio, PaymentPriority) else PaymentPriority(str(prio).upper())
            query = query.where(PaymentRequest.priority == parsed_prio)
            count_query = count_query.where(PaymentRequest.priority == parsed_prio)

        if f.get("expense_category"):
            cat = f["expense_category"]
            parsed_cat = cat if isinstance(cat, ExpenseCategory) else ExpenseCategory(str(cat).upper())
            query = query.where(PaymentRequest.expense_category == parsed_cat)
            count_query = count_query.where(PaymentRequest.expense_category == parsed_cat)

        if f.get("min_amount") is not None:
            min_amt = Decimal(str(f["min_amount"]))
            query = query.where(PaymentRequest.total_amount >= min_amt)
            count_query = count_query.where(PaymentRequest.total_amount >= min_amt)

        if f.get("max_amount") is not None:
            max_amt = Decimal(str(f["max_amount"]))
            query = query.where(PaymentRequest.total_amount <= max_amt)
            count_query = count_query.where(PaymentRequest.total_amount <= max_amt)

        if f.get("date_from"):
            d_from = f["date_from"]
            parsed_df = datetime.fromisoformat(d_from) if isinstance(d_from, str) else d_from
            query = query.where(PaymentRequest.created_at >= parsed_df)
            count_query = count_query.where(PaymentRequest.created_at >= parsed_df)

        if f.get("date_to"):
            d_to = f["date_to"]
            parsed_dt = datetime.fromisoformat(d_to) if isinstance(d_to, str) else d_to
            query = query.where(PaymentRequest.created_at <= parsed_dt)
            count_query = count_query.where(PaymentRequest.created_at <= parsed_dt)

        if f.get("search"):
            pat = f"%{str(f['search']).strip().lower()}%"
            search_clause = or_(
                func.lower(PaymentRequest.request_number).ilike(pat),
                func.lower(PaymentRequest.payment_purpose).ilike(pat),
                func.lower(PaymentRequest.invoice_number).ilike(pat),
            )
            query = query.where(search_clause)
            count_query = count_query.where(search_clause)

    total_res = await db.execute(count_query)
    total = total_res.scalar_one_or_none() or 0

    offset = (page - 1) * page_size
    query = query.order_by(PaymentRequest.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())

    total_pages = max(1, math.ceil(total / page_size)) if total > 0 else 1

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


async def cancel_payment_request(
    request_id: Union[uuid.UUID, str],
    user_id: Union[uuid.UUID, str],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> PaymentRequest:
    """
    Cancels a payment request. Only allowed before payment has been executed.

    Args:
        request_id: PaymentRequest UUID.
        user_id: Requesting User UUID.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The cancelled PaymentRequest model instance.

    Raises:
        HTTPException: 400 Bad Request if already paid/completed, 404 if not found.
    """
    parsed_id = request_id if isinstance(request_id, uuid.UUID) else uuid.UUID(str(request_id))
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

    stmt = select(PaymentRequest).where(
        PaymentRequest.id == parsed_id,
        PaymentRequest.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    req = result.scalar_one_or_none()

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PaymentRequest with ID '{parsed_id}' not found.",
        )

    # Disallow cancelling paid or completed vouchers
    if req.status in (PaymentStatus.PAID, PaymentStatus.COMPLETED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel payment request that has already been {req.status.value}.",
        )

    prev_status = req.status.value
    req.status = PaymentStatus.CANCELLED
    await db.flush()

    await log_event(
        user_id=parsed_user_id,
        event_type=AuditEventType.PAYMENT_REQUEST_CANCELLED,
        entity_type="payment_request",
        entity_id=req.id,
        previous_value={"status": prev_status},
        new_value={"status": PaymentStatus.CANCELLED.value},
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return req


# ==============================================================================
# DOCUMENT ATTACHMENT SERVICES
# ==============================================================================


async def upload_document(
    request_id: Union[uuid.UUID, str],
    file: UploadFile,
    user_id: Union[uuid.UUID, str],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> PaymentRequestDocument:
    """
    Validates, securely stores, and links an uploaded document to a payment request.

    Args:
        request_id: PaymentRequest UUID.
        file: FastAPI UploadFile object.
        user_id: Uploader User UUID.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The created PaymentRequestDocument model instance.

    Raises:
        HTTPException: 400 Bad Request on file validation failure, 404 if request not found.
    """
    parsed_id = request_id if isinstance(request_id, uuid.UUID) else uuid.UUID(str(request_id))
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

    # Verify request exists
    req = await db.get(PaymentRequest, parsed_id)
    if not req or req.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PaymentRequest with ID '{parsed_id}' not found.",
        )

    # Validate upload security (MIME signature, extension, size limit)
    await validate_file_upload(file, raise_exception=True)

    # Save to isolated filesystem storage
    saved_path_str = await save_upload(file)
    path_obj = Path(saved_path_str)
    file_size = path_obj.stat().st_size

    doc = PaymentRequestDocument(
        payment_request_id=parsed_id,
        file_name=path_obj.name,
        original_name=file.filename or path_obj.name,
        file_path=saved_path_str,
        file_size=file_size,
        mime_type=file.content_type or "application/octet-stream",
        uploaded_by_id=parsed_user_id,
    )

    db.add(doc)
    await db.flush()

    await log_event(
        user_id=parsed_user_id,
        event_type=AuditEventType.DOCUMENT_UPLOADED,
        entity_type="document",
        entity_id=doc.id,
        previous_value=None,
        new_value={
            "payment_request_id": str(parsed_id),
            "original_name": doc.original_name,
            "file_size": doc.file_size,
        },
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return doc


async def delete_document(
    doc_id: Union[uuid.UUID, str],
    user_id: Union[uuid.UUID, str],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> bool:
    """
    Soft-deletes a document attachment and logs the event.

    Args:
        doc_id: PaymentRequestDocument UUID.
        user_id: Requesting User UUID.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        True upon successful deletion.

    Raises:
        HTTPException: 404 Not Found if document does not exist.
    """
    parsed_id = doc_id if isinstance(doc_id, uuid.UUID) else uuid.UUID(str(doc_id))
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

    stmt = select(PaymentRequestDocument).where(
        PaymentRequestDocument.id == parsed_id,
        PaymentRequestDocument.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{parsed_id}' not found.",
        )

    doc.soft_delete()
    await db.flush()

    await log_event(
        user_id=parsed_user_id,
        event_type=AuditEventType.DOCUMENT_DELETED,
        entity_type="document",
        entity_id=doc.id,
        previous_value={"original_name": doc.original_name},
        new_value={"action": "soft_deleted"},
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return True


async def get_document(
    doc_id: Union[uuid.UUID, str],
    user_id: Union[uuid.UUID, str],
    db: AsyncSession,
) -> FileResponse:
    """
    Retrieves document attachment metadata and returns an asynchronous FileResponse.

    Args:
        doc_id: PaymentRequestDocument UUID.
        user_id: Requesting User UUID.
        db: Active AsyncSession database session.

    Returns:
        FastAPI FileResponse streaming the requested file securely.

    Raises:
        HTTPException: 404 Not Found if document record or disk asset is missing.
    """
    parsed_id = doc_id if isinstance(doc_id, uuid.UUID) else uuid.UUID(str(doc_id))

    stmt = select(PaymentRequestDocument).where(
        PaymentRequestDocument.id == parsed_id,
        PaymentRequestDocument.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{parsed_id}' not found.",
        )

    disk_path = Path(doc.file_path)
    if not disk_path.is_file():
        logger.error("Document asset missing on disk: %s", doc.file_path)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested file asset could not be located on storage.",
        )

    return FileResponse(
        path=str(disk_path),
        filename=doc.original_name,
        media_type=doc.mime_type,
    )

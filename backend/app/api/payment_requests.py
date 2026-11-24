"""
Payment Request API Router.

Implements end-to-end payment request management:
- GET /api/payment-requests - List requests with role-based scoping, status filters, and pagination
- POST /api/payment-requests - Create new payment request in DRAFT status
- GET /api/payment-requests/{id} - Retrieve complete payment request details
- PUT /api/payment-requests/{id} - Update draft payment request
- DELETE /api/payment-requests/{id} - Delete / cancel draft payment request
- POST /api/payment-requests/{id}/submit - Submit payment request for multi-level approval
- POST /api/payment-requests/{id}/cancel - Cancel pending or draft payment request
- POST /api/payment-requests/{id}/documents - Upload supporting invoice/quote attachments
- DELETE /api/payment-requests/{id}/documents/{doc_id} - Remove attached document
- GET /api/payment-requests/{id}/documents/{doc_id}/download - Download stored document
- POST /api/payment-requests/{id}/check-duplicate - Check for duplicate invoices
"""

from datetime import datetime, timezone
from decimal import Decimal
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

import aiofiles
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.middleware.rate_limit import get_client_ip
from app.models.approval import ApprovalRecord, ClarificationMessage
from app.models.audit_log import AuditEventType, AuditLog
from app.models.company import Company
from app.models.department import Department
from app.models.document import PaymentRequestDocument
from app.models.notification import Notification, NotificationType
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
from app.models.vendor import Vendor
from app.utils.security import (
    generate_request_number,
    generate_secure_filename,
    validate_file_upload,
)

logger = logging.getLogger("mv-payment-approval.api.payment_requests")
settings = get_settings()

router = APIRouter(prefix="/payment-requests", tags=["Payment Requests"])


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class DocumentResponse(BaseModel):
    id: uuid.UUID
    file_name: str
    original_name: str
    file_size: int
    mime_type: str
    uploaded_by_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class UserMiniResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str

    model_config = {"from_attributes": True}


class PaymentRequestSummaryResponse(BaseModel):
    id: uuid.UUID
    request_number: str
    company_id: uuid.UUID
    department_id: uuid.UUID
    requested_by_id: uuid.UUID
    requested_by: Optional[UserMiniResponse] = None
    vendor_id: Optional[uuid.UUID] = None
    expense_category: ExpenseCategory
    payment_purpose: str
    invoice_number: Optional[str] = None
    amount: Decimal
    gst_amount: Decimal
    total_amount: Decimal
    payment_mode: PaymentMode
    priority: PaymentPriority
    status: PaymentStatus
    assigned_approver_id: Optional[uuid.UUID] = None
    assigned_approver: Optional[UserMiniResponse] = None
    due_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaymentRequestDetailResponse(PaymentRequestSummaryResponse):
    bank_account: Optional[str] = None
    remarks: Optional[str] = None
    expense_subcategory: Optional[str] = None
    invoice_date: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    is_duplicate_override: bool
    duplicate_override_reason: Optional[str] = None
    documents: List[DocumentResponse] = []


class PaymentRequestListResponse(BaseModel):
    items: List[PaymentRequestSummaryResponse]
    total: int
    page: int
    page_size: int
    pages: int


class PaymentRequestCreateRequest(BaseModel):
    company_id: uuid.UUID = Field(..., description="Company entity")
    department_id: uuid.UUID = Field(..., description="Department originating the request")
    vendor_id: Optional[uuid.UUID] = None
    expense_category: ExpenseCategory
    expense_subcategory: Optional[str] = None
    payment_purpose: str = Field(..., min_length=3, description="Detailed explanation of payment")
    invoice_number: Optional[str] = None
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    amount: Decimal = Field(..., gt=0, description="Base amount before tax")
    gst_amount: Decimal = Field(default=Decimal("0.00"), ge=0, description="GST / tax amount")
    payment_mode: PaymentMode = PaymentMode.NEFT
    bank_account: Optional[str] = None
    priority: PaymentPriority = PaymentPriority.NORMAL
    remarks: Optional[str] = None
    assigned_approver_id: Optional[uuid.UUID] = None


class PaymentRequestUpdateRequest(BaseModel):
    department_id: Optional[uuid.UUID] = None
    vendor_id: Optional[uuid.UUID] = None
    expense_category: Optional[ExpenseCategory] = None
    expense_subcategory: Optional[str] = None
    payment_purpose: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    amount: Optional[Decimal] = Field(None, gt=0)
    gst_amount: Optional[Decimal] = Field(None, ge=0)
    payment_mode: Optional[PaymentMode] = None
    bank_account: Optional[str] = None
    priority: Optional[PaymentPriority] = None
    remarks: Optional[str] = None
    assigned_approver_id: Optional[uuid.UUID] = None


class DuplicateCheckResponse(BaseModel):
    is_duplicate: bool
    matching_count: int
    matches: List[PaymentRequestSummaryResponse] = []


class DuplicateOverrideRequest(BaseModel):
    reason: str = Field(..., min_length=5, description="Justification for bypassing duplicate warning")


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

@router.get(
    "",
    response_model=PaymentRequestListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Payment Requests",
    description="Retrieves a list of payment requests filtered according to user role permissions.",
)
async def list_payment_requests(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    status_filter: Optional[PaymentStatus] = Query(None, alias="status", description="Filter by status"),
    company_id: Optional[uuid.UUID] = Query(None, description="Filter by company"),
    department_id: Optional[uuid.UUID] = Query(None, description="Filter by department"),
    vendor_id: Optional[uuid.UUID] = Query(None, description="Filter by vendor"),
    priority: Optional[PaymentPriority] = Query(None, description="Filter by priority"),
    search: Optional[str] = Query(None, description="Search request number, invoice, or purpose"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base_query = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
        )
        .where(PaymentRequest.is_deleted == False)
    )

    # Role-based scoping:
    user_role = current_user.role.name.lower()
    if user_role == RoleEnum.SUPER_ADMIN.value:
        pass  # Super admin sees all requests
    elif user_role == RoleEnum.ACCOUNTANT.value:
        # Accountant sees requests within their company
        if current_user.company_id:
            base_query = base_query.where(PaymentRequest.company_id == current_user.company_id)
    elif user_role == RoleEnum.DIRECTOR.value:
        # Director sees all company requests or assigned requests
        if current_user.company_id:
            base_query = base_query.where(PaymentRequest.company_id == current_user.company_id)
    elif user_role == RoleEnum.DEPARTMENT_HEAD.value:
        # Department Head sees own requests and requests from their department or assigned to them
        base_query = base_query.where(
            or_(
                PaymentRequest.requested_by_id == current_user.id,
                PaymentRequest.department_id == current_user.department_id,
                PaymentRequest.assigned_approver_id == current_user.id,
            )
        )
    else:
        # Standard users see only their own requests
        base_query = base_query.where(PaymentRequest.requested_by_id == current_user.id)

    # Query param filters
    if status_filter:
        base_query = base_query.where(PaymentRequest.status == status_filter)
    if company_id:
        base_query = base_query.where(PaymentRequest.company_id == company_id)
    if department_id:
        base_query = base_query.where(PaymentRequest.department_id == department_id)
    if vendor_id:
        base_query = base_query.where(PaymentRequest.vendor_id == vendor_id)
    if priority:
        base_query = base_query.where(PaymentRequest.priority == priority)
    if search:
        search_filter = f"%{search.strip()}%"
        base_query = base_query.where(
            or_(
                PaymentRequest.request_number.ilike(search_filter),
                PaymentRequest.invoice_number.ilike(search_filter),
                PaymentRequest.payment_purpose.ilike(search_filter),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = base_query.order_by(desc(PaymentRequest.created_at)).offset(offset).limit(page_size)
    result = await db.execute(query)
    records = result.scalars().all()

    pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaymentRequestListResponse(
        items=[PaymentRequestSummaryResponse.model_validate(r) for r in records],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.post(
    "",
    response_model=PaymentRequestDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Payment Request",
    description="Initializes a new payment request in DRAFT status.",
)
async def create_payment_request(
    request: Request,
    payload_in: PaymentRequestCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate company
    comp_q = select(Company).where(Company.id == payload_in.company_id, Company.is_active == True)
    comp_res = await db.execute(comp_q)
    if not comp_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid active company_id.")

    # Validate department
    dept_q = select(Department).where(Department.id == payload_in.department_id, Department.is_active == True)
    dept_res = await db.execute(dept_q)
    if not dept_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid active department_id.")

    # Validate vendor if specified
    if payload_in.vendor_id:
        vend_q = select(Vendor).where(
            Vendor.id == payload_in.vendor_id,
            Vendor.company_id == payload_in.company_id,
            Vendor.is_deleted == False,
        )
        vend_res = await db.execute(vend_q)
        if not vend_res.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid vendor_id for this company.")

    # Generate sequential request reference number
    year = datetime.now(timezone.utc).year
    count_q = select(func.count()).select_from(PaymentRequest).where(
        PaymentRequest.company_id == payload_in.company_id,
        func.extract("year", PaymentRequest.created_at) == year,
    )
    count_res = await db.execute(count_q)
    seq = count_res.scalar_one() + 1
    req_number = generate_request_number(prefix="PR", year=year, sequence=seq)

    # Compute total
    total = payload_in.amount + payload_in.gst_amount

    # Attempt smart approver assignment if not specified
    assigned_approver = payload_in.assigned_approver_id
    if not assigned_approver:
        # Check approval rules for amount range
        rule_q = (
            select(ApprovalRule)
            .where(
                ApprovalRule.company_id == payload_in.company_id,
                ApprovalRule.is_active == True,
                ApprovalRule.min_amount <= total,
                or_(ApprovalRule.max_amount >= total, ApprovalRule.max_amount == None),
            )
            .order_by(ApprovalRule.min_amount.desc())
        )
        rule_res = await db.execute(rule_q)
        matching_rule = rule_res.scalars().first()

        if matching_rule:
            # Find an active user with that role
            u_rule_q = (
                select(User)
                .join(User.role)
                .where(
                    User.company_id == payload_in.company_id,
                    User.is_active == True,
                    User.is_deleted == False,
                    Role.name == matching_rule.approver_role,
                )
            )
            u_res = await db.execute(u_rule_q)
            potential_approver = u_res.scalars().first()
            if potential_approver:
                assigned_approver = potential_approver.id

    payment_req = PaymentRequest(
        request_number=req_number,
        company_id=payload_in.company_id,
        department_id=payload_in.department_id,
        requested_by_id=current_user.id,
        vendor_id=payload_in.vendor_id,
        expense_category=payload_in.expense_category,
        expense_subcategory=payload_in.expense_subcategory,
        payment_purpose=payload_in.payment_purpose.strip(),
        invoice_number=payload_in.invoice_number.strip() if payload_in.invoice_number else None,
        invoice_date=payload_in.invoice_date,
        due_date=payload_in.due_date,
        amount=payload_in.amount,
        gst_amount=payload_in.gst_amount,
        total_amount=total,
        payment_mode=payload_in.payment_mode,
        bank_account=payload_in.bank_account,
        priority=payload_in.priority,
        remarks=payload_in.remarks,
        status=PaymentStatus.DRAFT,
        assigned_approver_id=assigned_approver,
    )
    db.add(payment_req)
    await db.flush()

    audit = AuditLog(
        user_id=current_user.id,
        event_type=AuditEventType.PAYMENT_REQUEST_CREATED,
        entity_type="payment_request",
        entity_id=payment_req.id,
        new_value={"request_number": payment_req.request_number, "total_amount": str(payment_req.total_amount)},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    # Re-fetch full details
    full_q = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
            selectinload(PaymentRequest.documents),
        )
        .where(PaymentRequest.id == payment_req.id)
    )
    full_res = await db.execute(full_q)
    return PaymentRequestDetailResponse.model_validate(full_res.scalar_one())


@router.get(
    "/{id}",
    response_model=PaymentRequestDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Payment Request Details",
    description="Retrieves complete information, associated documents, and approval states for a payment request.",
)
async def get_payment_request(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
            selectinload(PaymentRequest.documents),
        )
        .where(PaymentRequest.id == id, PaymentRequest.is_deleted == False)
    )
    result = await db.execute(query)
    req_item = result.scalar_one_or_none()

    if not req_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment request with ID '{id}' was not found.",
        )

    return PaymentRequestDetailResponse.model_validate(req_item)


@router.put(
    "/{id}",
    response_model=PaymentRequestDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Payment Request",
    description="Updates a payment request. Allowed only when status is DRAFT.",
)
async def update_payment_request(
    id: uuid.UUID,
    payload_in: PaymentRequestUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
            selectinload(PaymentRequest.documents),
        )
        .where(PaymentRequest.id == id, PaymentRequest.is_deleted == False)
    )
    result = await db.execute(query)
    req_item = result.scalar_one_or_none()

    if not req_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment request with ID '{id}' was not found.",
        )

    # Only DRAFT status can be modified
    if req_item.status != PaymentStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot modify request with status '{req_item.status.value}'. Only DRAFT requests can be updated.",
        )

    # Only owner or admin can update
    if req_item.requested_by_id != current_user.id and current_user.role.name != RoleEnum.SUPER_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to update this payment request.",
        )

    prev_vals = {
        "amount": str(req_item.amount),
        "gst_amount": str(req_item.gst_amount),
        "total_amount": str(req_item.total_amount),
    }

    if payload_in.department_id is not None:
        req_item.department_id = payload_in.department_id
    if payload_in.vendor_id is not None:
        req_item.vendor_id = payload_in.vendor_id
    if payload_in.expense_category is not None:
        req_item.expense_category = payload_in.expense_category
    if payload_in.expense_subcategory is not None:
        req_item.expense_subcategory = payload_in.expense_subcategory
    if payload_in.payment_purpose is not None:
        req_item.payment_purpose = payload_in.payment_purpose.strip()
    if payload_in.invoice_number is not None:
        req_item.invoice_number = payload_in.invoice_number.strip()
    if payload_in.invoice_date is not None:
        req_item.invoice_date = payload_in.invoice_date
    if payload_in.due_date is not None:
        req_item.due_date = payload_in.due_date
    if payload_in.amount is not None:
        req_item.amount = payload_in.amount
    if payload_in.gst_amount is not None:
        req_item.gst_amount = payload_in.gst_amount
    if payload_in.payment_mode is not None:
        req_item.payment_mode = payload_in.payment_mode
    if payload_in.bank_account is not None:
        req_item.bank_account = payload_in.bank_account
    if payload_in.priority is not None:
        req_item.priority = payload_in.priority
    if payload_in.remarks is not None:
        req_item.remarks = payload_in.remarks
    if payload_in.assigned_approver_id is not None:
        req_item.assigned_approver_id = payload_in.assigned_approver_id

    # Recalculate total amount
    req_item.total_amount = req_item.amount + req_item.gst_amount

    audit = AuditLog(
        user_id=current_user.id,
        event_type=AuditEventType.PAYMENT_REQUEST_UPDATED,
        entity_type="payment_request",
        entity_id=req_item.id,
        previous_value=prev_vals,
        new_value={"total_amount": str(req_item.total_amount)},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    full_q = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
            selectinload(PaymentRequest.documents),
        )
        .where(PaymentRequest.id == req_item.id)
    )
    full_res = await db.execute(full_q)
    return PaymentRequestDetailResponse.model_validate(full_res.scalar_one())


@router.delete(
    "/{id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Payment Request",
    description="Soft-deletes a draft or cancelled payment request. Authorized for requester or administrator.",
)
async def delete_payment_request(
    id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(PaymentRequest).where(PaymentRequest.id == id, PaymentRequest.is_deleted == False)
    result = await db.execute(query)
    req_item = result.scalar_one_or_none()

    if not req_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment request with ID '{id}' was not found.",
        )

    # Only requester or super admin can delete
    is_admin = current_user.role.name == RoleEnum.SUPER_ADMIN.value
    if req_item.requested_by_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this payment request.",
        )

    # Disallow deleting requests that are already approved, paid, or completed unless super admin
    if req_item.status in (PaymentStatus.APPROVED, PaymentStatus.PAID, PaymentStatus.COMPLETED) and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete payment request with status '{req_item.status.value}'.",
        )

    req_item.soft_delete()

    audit = AuditLog(
        user_id=current_user.id,
        event_type=AuditEventType.PAYMENT_REQUEST_DELETED,
        entity_type="payment_request",
        entity_id=req_item.id,
        previous_value={"request_number": req_item.request_number, "status": req_item.status.value},
        new_value={"is_deleted": True},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    return {"success": True, "message": f"Payment request '{req_item.request_number}' has been deleted."}



@router.post(
    "/{id}/submit",
    response_model=PaymentRequestDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit Payment Request for Approval",
    description="Submits a draft payment request into the active approval workflow.",
)
async def submit_payment_request(
    id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
            selectinload(PaymentRequest.documents),
        )
        .where(PaymentRequest.id == id, PaymentRequest.is_deleted == False)
    )
    result = await db.execute(query)
    req_item = result.scalar_one_or_none()

    if not req_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment request with ID '{id}' was not found.",
        )

    if req_item.status not in (PaymentStatus.DRAFT, PaymentStatus.CLARIFICATION_REQUIRED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit request with status '{req_item.status.value}'.",
        )

    # Check matching approval rule for threshold
    rule_q = (
        select(ApprovalRule)
        .where(
            ApprovalRule.company_id == req_item.company_id,
            ApprovalRule.is_active == True,
            ApprovalRule.min_amount <= req_item.total_amount,
            or_(ApprovalRule.max_amount >= req_item.total_amount, ApprovalRule.max_amount == None),
        )
        .order_by(ApprovalRule.min_amount.desc())
    )
    rule_res = await db.execute(rule_q)
    matching_rule = rule_res.scalars().first()

    requires_approval = True
    if matching_rule is not None:
        requires_approval = matching_rule.requires_approval

    req_item.submitted_at = datetime.now(timezone.utc)

    if not requires_approval:
        req_item.status = PaymentStatus.APPROVED
        req_item.approved_at = datetime.now(timezone.utc)
    else:
        req_item.status = PaymentStatus.PENDING_APPROVAL

        # Notify assigned approver
        if req_item.assigned_approver_id:
            notif = Notification(
                user_id=req_item.assigned_approver_id,
                title=f"Payment Request Pending Approval: {req_item.request_number}",
                message=f"Payment request '{req_item.request_number}' for amount {req_item.total_amount} requires your approval.",
                type=NotificationType.PAYMENT_SUBMITTED,
                entity_type="payment_request",
                entity_id=req_item.id,
            )
            db.add(notif)

    audit = AuditLog(
        user_id=current_user.id,
        event_type=AuditEventType.PAYMENT_REQUEST_SUBMITTED,
        entity_type="payment_request",
        entity_id=req_item.id,
        new_value={"status": req_item.status.value},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    full_q = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
            selectinload(PaymentRequest.documents),
        )
        .where(PaymentRequest.id == req_item.id)
    )
    full_res = await db.execute(full_q)
    return PaymentRequestDetailResponse.model_validate(full_res.scalar_one())


@router.post(
    "/{id}/cancel",
    response_model=PaymentRequestDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel Payment Request",
    description="Cancels an active or draft payment request.",
)
async def cancel_payment_request(
    id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
            selectinload(PaymentRequest.documents),
        )
        .where(PaymentRequest.id == id, PaymentRequest.is_deleted == False)
    )
    result = await db.execute(query)
    req_item = result.scalar_one_or_none()

    if not req_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment request with ID '{id}' was not found.",
        )

    if req_item.status in (PaymentStatus.PAID, PaymentStatus.COMPLETED, PaymentStatus.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel request in status '{req_item.status.value}'.",
        )

    if req_item.requested_by_id != current_user.id and current_user.role.name != RoleEnum.SUPER_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the requester or an administrator can cancel this request.",
        )

    req_item.status = PaymentStatus.CANCELLED

    audit = AuditLog(
        user_id=current_user.id,
        event_type=AuditEventType.PAYMENT_REQUEST_CANCELLED,
        entity_type="payment_request",
        entity_id=req_item.id,
        new_value={"status": PaymentStatus.CANCELLED.value},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    full_q = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
            selectinload(PaymentRequest.documents),
        )
        .where(PaymentRequest.id == req_item.id)
    )
    full_res = await db.execute(full_q)
    return PaymentRequestDetailResponse.model_validate(full_res.scalar_one())


@router.post(
    "/{id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Supporting Document",
    description="Uploads and associates an invoice or supporting attachment with the payment request.",
)
async def upload_document(
    id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate payment request exists
    q = select(PaymentRequest).where(PaymentRequest.id == id, PaymentRequest.is_deleted == False)
    res = await db.execute(q)
    req_item = res.scalar_one_or_none()

    if not req_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment request with ID '{id}' was not found.",
        )

    # Validate file format and size
    await validate_file_upload(file)

    # Generate secure filesystem name
    safe_name = generate_secure_filename(file.filename)
    dest_path = settings.upload_path / safe_name

    # Save to disk asynchronously
    async with aiofiles.open(dest_path, "wb") as out_file:
        while content := await file.read(1024 * 64):  # 64 KB chunks
            await out_file.write(content)

    file_size = os.path.getsize(dest_path)
    mime_type = file.content_type or "application/octet-stream"

    # Store document record
    doc_record = PaymentRequestDocument(
        payment_request_id=id,
        file_name=safe_name,
        original_name=file.filename,
        file_path=str(dest_path),
        file_size=file_size,
        mime_type=mime_type,
        uploaded_by_id=current_user.id,
    )
    db.add(doc_record)
    await db.flush()

    audit = AuditLog(
        user_id=current_user.id,
        event_type=AuditEventType.DOCUMENT_UPLOADED,
        entity_type="document",
        entity_id=doc_record.id,
        new_value={"original_name": doc_record.original_name, "file_size": doc_record.file_size},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()
    await db.refresh(doc_record)

    return DocumentResponse.model_validate(doc_record)


@router.delete(
    "/{id}/documents/{doc_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Document",
    description="Removes an uploaded supporting attachment.",
)
async def delete_document(
    id: uuid.UUID,
    doc_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(PaymentRequestDocument).where(
        PaymentRequestDocument.id == doc_id,
        PaymentRequestDocument.payment_request_id == id,
        PaymentRequestDocument.is_deleted == False,
    )
    result = await db.execute(query)
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document attachment not found.",
        )

    # Soft delete document
    doc.soft_delete()

    audit = AuditLog(
        user_id=current_user.id,
        event_type=AuditEventType.DOCUMENT_DELETED,
        entity_type="document",
        entity_id=doc.id,
        previous_value={"original_name": doc.original_name},
        new_value={"is_deleted": True},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    return {"success": True, "message": "Document successfully deleted."}


@router.get(
    "/{id}/documents/{doc_id}/download",
    summary="Download Supporting Document",
    description="Streams the specified uploaded attachment file.",
)
async def download_document(
    id: uuid.UUID,
    doc_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(PaymentRequestDocument).where(
        PaymentRequestDocument.id == doc_id,
        PaymentRequestDocument.payment_request_id == id,
        PaymentRequestDocument.is_deleted == False,
    )
    result = await db.execute(query)
    doc = result.scalar_one_or_none()

    if not doc or not os.path.exists(doc.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requested file does not exist on storage.",
        )

    return FileResponse(
        path=doc.file_path,
        media_type=doc.mime_type,
        filename=doc.original_name,
    )


@router.post(
    "/{id}/check-duplicate",
    response_model=DuplicateCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Check Duplicate Invoice",
    description="Inspects system records for potential duplicate invoice numbers or identical disbursement amounts.",
)
async def check_duplicate_request(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    q = select(PaymentRequest).where(PaymentRequest.id == id, PaymentRequest.is_deleted == False)
    res = await db.execute(q)
    target = res.scalar_one_or_none()

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment request '{id}' was not found.",
        )

    if not target.vendor_id or not target.invoice_number:
        return DuplicateCheckResponse(is_duplicate=False, matching_count=0, matches=[])

    # Check for identical invoice number for the same vendor and company
    dup_q = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
        )
        .where(
            PaymentRequest.id != target.id,
            PaymentRequest.company_id == target.company_id,
            PaymentRequest.vendor_id == target.vendor_id,
            PaymentRequest.invoice_number == target.invoice_number,
            PaymentRequest.status != PaymentStatus.CANCELLED,
            PaymentRequest.is_deleted == False,
        )
    )
    dup_res = await db.execute(dup_q)
    duplicates = dup_res.scalars().all()

    is_dup = len(duplicates) > 0
    return DuplicateCheckResponse(
        is_duplicate=is_dup,
        matching_count=len(duplicates),
        matches=[PaymentRequestSummaryResponse.model_validate(d) for d in duplicates],
    )

"""
Payment Approvals and Clarifications API Router.

Implements workflow governance, maker-checker separation of duties, and audit trail:
- GET /api/approvals/pending - Pending approvals queue for current user
- POST /api/approvals/{request_id}/approve - Formal sign-off on payment disbursement
- POST /api/approvals/{request_id}/reject - Formal rejection with mandatory justification
- POST /api/approvals/{request_id}/clarify - Request additional context or supporting documents
- POST /api/approvals/{request_id}/respond - Requester response to clarification inquiry
- GET /api/approvals/{request_id}/history - Complete decision and dialogue audit log

STRICT ENFORCEMENT:
- Approver cannot approve their own payment request (maker != checker).
- Only the assigned approver (or super administrator) can take approval action.
- Only requests in PENDING_APPROVAL status can be approved or rejected.
"""

from datetime import datetime, timezone
from decimal import Decimal
import logging
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.middleware.rate_limit import get_client_ip
from app.models.approval import ApprovalRecord, ApprovalStatus, ClarificationMessage
from app.models.audit_log import AuditEventType, AuditLog
from app.models.notification import Notification, NotificationType
from app.models.payment_request import PaymentRequest, PaymentStatus
from app.models.role import RoleEnum
from app.models.user import User

logger = logging.getLogger("mv-payment-approval.api.approvals")

router = APIRouter(prefix="/approvals", tags=["Approvals"])


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class ApproverMiniResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str

    model_config = {"from_attributes": True}


class ApprovalRecordResponse(BaseModel):
    id: uuid.UUID
    payment_request_id: uuid.UUID
    approver_id: uuid.UUID
    approver: Optional[ApproverMiniResponse] = None
    status: ApprovalStatus
    comment: Optional[str] = None
    original_amount: Decimal
    approved_amount: Optional[Decimal] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ClarificationMessageResponse(BaseModel):
    id: uuid.UUID
    payment_request_id: uuid.UUID
    sender_id: uuid.UUID
    sender: Optional[ApproverMiniResponse] = None
    message: str
    is_response: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ApprovalHistoryResponse(BaseModel):
    payment_request_id: uuid.UUID
    current_status: PaymentStatus
    approval_records: List[ApprovalRecordResponse] = []
    clarification_messages: List[ClarificationMessageResponse] = []


class ApprovePaymentRequest(BaseModel):
    comment: Optional[str] = Field(None, description="Optional approval remarks")
    approved_amount: Optional[Decimal] = Field(
        None, gt=0, description="Optional adjusted approved amount if modifying payout"
    )


class RejectPaymentRequest(BaseModel):
    reason: str = Field(..., min_length=5, description="Mandatory reason for rejection")


class ClarifyPaymentRequest(BaseModel):
    message: str = Field(..., min_length=5, description="Specific clarification question or request")


class ClarificationResponseRequest(BaseModel):
    message: str = Field(..., min_length=3, description="Response addressing the clarification request")


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

@router.get(
    "/pending",
    status_code=status.HTTP_200_OK,
    summary="Get Pending Approvals",
    description="Returns all payment requests awaiting approval from the currently logged-in user.",
)
async def get_pending_approvals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.company),
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.vendor),
        )
        .where(
            PaymentRequest.status == PaymentStatus.PENDING_APPROVAL,
            PaymentRequest.is_deleted == False,
        )
    )

    # Scoping: If super admin, see all pending; otherwise only those assigned to current user
    if current_user.role.name != RoleEnum.SUPER_ADMIN.value:
        query = query.where(PaymentRequest.assigned_approver_id == current_user.id)

    query = query.order_by(PaymentRequest.priority.desc(), PaymentRequest.created_at.asc())
    result = await db.execute(query)
    pending_items = result.scalars().all()

    return [
        {
            "id": p.id,
            "request_number": p.request_number,
            "company_name": p.company.name if p.company else None,
            "department_name": p.department.name if p.department else None,
            "vendor_name": p.vendor.name if p.vendor else None,
            "requested_by_name": p.requested_by.full_name if p.requested_by else None,
            "total_amount": p.total_amount,
            "expense_category": p.expense_category.value,
            "payment_purpose": p.payment_purpose,
            "invoice_number": p.invoice_number,
            "priority": p.priority.value,
            "due_date": p.due_date,
            "created_at": p.created_at,
        }
        for p in pending_items
    ]


@router.post(
    "/{request_id}/approve",
    response_model=ApprovalRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve Payment Request",
    description="Records approval sign-off. Enforces maker-checker separation and authorization.",
)
async def approve_payment(
    request_id: uuid.UUID,
    payload_in: ApprovePaymentRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(PaymentRequest)
        .options(selectinload(PaymentRequest.requested_by))
        .where(PaymentRequest.id == request_id, PaymentRequest.is_deleted == False)
    )
    result = await db.execute(query)
    payment_req = result.scalar_one_or_none()

    if not payment_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment request '{request_id}' was not found.",
        )

    # 1. Enforce Status Check: Only PENDING_APPROVAL can be approved
    if payment_req.status != PaymentStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve request with status '{payment_req.status.value}'. Must be PENDING_APPROVAL.",
        )

    # 2. Enforce Maker-Checker: Approver cannot approve own request
    if payment_req.requested_by_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Maker-checker policy violation: You cannot approve your own payment request.",
        )

    # 3. Enforce Assigned Approver constraint (or Super Admin override)
    is_admin = current_user.role.name == RoleEnum.SUPER_ADMIN.value
    if payment_req.assigned_approver_id and payment_req.assigned_approver_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the designated approver for this payment request.",
        )

    client_ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent", "")[:500]

    # Create immutable approval record
    approved_amt = payload_in.approved_amount or payment_req.total_amount
    approval_rec = ApprovalRecord(
        payment_request_id=payment_req.id,
        approver_id=current_user.id,
        status=ApprovalStatus.APPROVED,
        comment=payload_in.comment,
        original_amount=payment_req.total_amount,
        approved_amount=approved_amt,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    db.add(approval_rec)

    # Update PaymentRequest status
    payment_req.status = PaymentStatus.APPROVED
    payment_req.approved_at = datetime.now(timezone.utc)
    if payload_in.approved_amount is not None:
        payment_req.total_amount = payload_in.approved_amount

    # Send Notification to requester
    notif = Notification(
        user_id=payment_req.requested_by_id,
        title=f"Payment Request Approved: {payment_req.request_number}",
        message=f"Your payment request '{payment_req.request_number}' for amount {approved_amt} has been approved by {current_user.full_name}.",
        type=NotificationType.PAYMENT_APPROVED,
        entity_type="payment_request",
        entity_id=payment_req.id,
    )
    db.add(notif)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type=AuditEventType.PAYMENT_REQUEST_APPROVED,
        entity_type="payment_request",
        entity_id=payment_req.id,
        new_value={"status": PaymentStatus.APPROVED.value, "approved_amount": str(approved_amt)},
        ip_address=client_ip,
        user_agent=user_agent,
    )
    db.add(audit)
    await db.commit()

    # Re-fetch with approver loaded
    rec_q = (
        select(ApprovalRecord)
        .options(selectinload(ApprovalRecord.approver))
        .where(ApprovalRecord.id == approval_rec.id)
    )
    rec_res = await db.execute(rec_q)
    return ApprovalRecordResponse.model_validate(rec_res.scalar_one())


@router.post(
    "/{request_id}/reject",
    response_model=ApprovalRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject Payment Request",
    description="Rejects a payment request with a mandatory reason for rejection.",
)
async def reject_payment(
    request_id: uuid.UUID,
    payload_in: RejectPaymentRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(PaymentRequest)
        .where(PaymentRequest.id == request_id, PaymentRequest.is_deleted == False)
    )
    result = await db.execute(query)
    payment_req = result.scalar_one_or_none()

    if not payment_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment request '{request_id}' was not found.",
        )

    if payment_req.status != PaymentStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject request with status '{payment_req.status.value}'. Must be PENDING_APPROVAL.",
        )

    # Approver cannot be requester
    if payment_req.requested_by_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot reject your own payment request.",
        )

    # Check assignment
    is_admin = current_user.role.name == RoleEnum.SUPER_ADMIN.value
    if payment_req.assigned_approver_id and payment_req.assigned_approver_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to reject this payment request.",
        )

    client_ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent", "")[:500]

    approval_rec = ApprovalRecord(
        payment_request_id=payment_req.id,
        approver_id=current_user.id,
        status=ApprovalStatus.REJECTED,
        comment=payload_in.reason.strip(),
        original_amount=payment_req.total_amount,
        approved_amount=Decimal("0.00"),
        ip_address=client_ip,
        user_agent=user_agent,
    )
    db.add(approval_rec)

    payment_req.status = PaymentStatus.REJECTED
    payment_req.rejected_at = datetime.now(timezone.utc)

    # Notification to requester
    notif = Notification(
        user_id=payment_req.requested_by_id,
        title=f"Payment Request Rejected: {payment_req.request_number}",
        message=f"Your payment request '{payment_req.request_number}' was rejected by {current_user.full_name}. Reason: {payload_in.reason}",
        type=NotificationType.PAYMENT_REJECTED,
        entity_type="payment_request",
        entity_id=payment_req.id,
    )
    db.add(notif)

    audit = AuditLog(
        user_id=current_user.id,
        event_type=AuditEventType.PAYMENT_REQUEST_REJECTED,
        entity_type="payment_request",
        entity_id=payment_req.id,
        new_value={"status": PaymentStatus.REJECTED.value, "reason": payload_in.reason},
        ip_address=client_ip,
        user_agent=user_agent,
    )
    db.add(audit)
    await db.commit()

    rec_q = (
        select(ApprovalRecord)
        .options(selectinload(ApprovalRecord.approver))
        .where(ApprovalRecord.id == approval_rec.id)
    )
    rec_res = await db.execute(rec_q)
    return ApprovalRecordResponse.model_validate(rec_res.scalar_one())


@router.post(
    "/{request_id}/clarify",
    response_model=ClarificationMessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Request Clarification",
    description="Opens an interactive query thread between the reviewer and requester.",
)
async def request_clarification(
    request_id: uuid.UUID,
    payload_in: ClarifyPaymentRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(PaymentRequest).where(PaymentRequest.id == request_id, PaymentRequest.is_deleted == False)
    result = await db.execute(query)
    payment_req = result.scalar_one_or_none()

    if not payment_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment request '{request_id}' was not found.",
        )

    # Update request status to CLARIFICATION_REQUIRED
    payment_req.status = PaymentStatus.CLARIFICATION_REQUIRED

    msg = ClarificationMessage(
        payment_request_id=payment_req.id,
        sender_id=current_user.id,
        message=payload_in.message.strip(),
        is_response=False,
    )
    db.add(msg)

    # Notify requester
    notif = Notification(
        user_id=payment_req.requested_by_id,
        title=f"Clarification Requested: {payment_req.request_number}",
        message=f"{current_user.full_name} has requested clarification on '{payment_req.request_number}': {payload_in.message}",
        type=NotificationType.CLARIFICATION_REQUESTED,
        entity_type="payment_request",
        entity_id=payment_req.id,
    )
    db.add(notif)

    audit = AuditLog(
        user_id=current_user.id,
        event_type=AuditEventType.PAYMENT_REQUEST_CLARIFICATION_REQUESTED,
        entity_type="payment_request",
        entity_id=payment_req.id,
        new_value={"message": payload_in.message},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    msg_q = (
        select(ClarificationMessage)
        .options(selectinload(ClarificationMessage.sender))
        .where(ClarificationMessage.id == msg.id)
    )
    msg_res = await db.execute(msg_q)
    return ClarificationMessageResponse.model_validate(msg_res.scalar_one())


@router.post(
    "/{request_id}/respond",
    response_model=ClarificationMessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Respond to Clarification Request",
    description="Permits requester to submit replies to queries and transitions request back to PENDING_APPROVAL.",
)
async def respond_to_clarification(
    request_id: uuid.UUID,
    payload_in: ClarificationResponseRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(PaymentRequest).where(PaymentRequest.id == request_id, PaymentRequest.is_deleted == False)
    result = await db.execute(query)
    payment_req = result.scalar_one_or_none()

    if not payment_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment request '{request_id}' was not found.",
        )

    # Re-transition request back to PENDING_APPROVAL so approver can act
    payment_req.status = PaymentStatus.PENDING_APPROVAL

    msg = ClarificationMessage(
        payment_request_id=payment_req.id,
        sender_id=current_user.id,
        message=payload_in.message.strip(),
        is_response=True,
    )
    db.add(msg)

    # Notify assigned approver
    if payment_req.assigned_approver_id:
        notif = Notification(
            user_id=payment_req.assigned_approver_id,
            title=f"Clarification Response Provided: {payment_req.request_number}",
            message=f"{current_user.full_name} has provided clarification for request '{payment_req.request_number}'.",
            type=NotificationType.CLARIFICATION_PROVIDED,
            entity_type="payment_request",
            entity_id=payment_req.id,
        )
        db.add(notif)

    audit = AuditLog(
        user_id=current_user.id,
        event_type=AuditEventType.PAYMENT_REQUEST_CLARIFICATION_RESPONDED,
        entity_type="payment_request",
        entity_id=payment_req.id,
        new_value={"message": payload_in.message},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    msg_q = (
        select(ClarificationMessage)
        .options(selectinload(ClarificationMessage.sender))
        .where(ClarificationMessage.id == msg.id)
    )
    msg_res = await db.execute(msg_q)
    return ClarificationMessageResponse.model_validate(msg_res.scalar_one())


@router.get(
    "/{request_id}/history",
    response_model=ApprovalHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Approval and Clarification History",
    description="Returns chronological audit logs of all approvals, rejections, and clarification messages.",
)
async def get_approval_history(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    q = select(PaymentRequest).where(PaymentRequest.id == request_id, PaymentRequest.is_deleted == False)
    res = await db.execute(q)
    payment_req = res.scalar_one_or_none()

    if not payment_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment request '{request_id}' was not found.",
        )

    # Fetch approval records
    app_q = (
        select(ApprovalRecord)
        .options(selectinload(ApprovalRecord.approver))
        .where(ApprovalRecord.payment_request_id == request_id)
        .order_by(ApprovalRecord.created_at.asc())
    )
    app_res = await db.execute(app_q)
    approval_records = app_res.scalars().all()

    # Fetch clarification messages
    clar_q = (
        select(ClarificationMessage)
        .options(selectinload(ClarificationMessage.sender))
        .where(ClarificationMessage.payment_request_id == request_id)
        .order_by(ClarificationMessage.created_at.asc())
    )
    clar_res = await db.execute(clar_q)
    clar_messages = clar_res.scalars().all()

    return ApprovalHistoryResponse(
        payment_request_id=payment_req.id,
        current_status=payment_req.status,
        approval_records=[ApprovalRecordResponse.model_validate(r) for r in approval_records],
        clarification_messages=[ClarificationMessageResponse.model_validate(m) for m in clar_messages],
    )

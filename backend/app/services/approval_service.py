"""
Approval Workflow Service for MV Payment Approval System.

Enforces corporate financial governance:
- Separation of Duties (requesters cannot approve their own requests)
- Immutable ApprovalRecord ledger creation
- Status transitions and threshold compliance
- Clarification message dialogue
- Multi-channel notification alerts
"""

from datetime import datetime, timezone
from decimal import Decimal
import logging
import math
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union
import uuid

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.approval import ApprovalRecord, ApprovalStatus, ClarificationMessage
from app.models.audit_log import AuditEventType
from app.models.notification import NotificationType
from app.models.payment_request import PaymentPriority, PaymentRequest, PaymentStatus
from app.models.role import Role, RoleEnum
from app.models.user import User
from app.services.audit_service import log_event
from app.services.notification_service import create_notification, send_email_notification
from app.utils.email import send_clarification_notification, send_rejection_notification

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


async def approve_request(
    request_id: Union[uuid.UUID, str],
    approver_id: Union[uuid.UUID, str],
    comment: Optional[str],
    approved_amount: Optional[Union[Decimal, float, int]],
    ip: Optional[str],
    user_agent: Optional[str],
    db: AsyncSession,
) -> ApprovalRecord:
    """
    Approves a payment request and creates an immutable ApprovalRecord.

    CRITICAL RULES ENFORCED:
    1. Approver CANNOT approve their own requests (requested_by_id != approver_id).
    2. Only assigned approver (or company director / super admin) can approve.
    3. Only requests in PENDING_APPROVAL status can be approved.
    4. Creates immutable ApprovalRecord.
    5. Dispatches notifications to requester and finance accountants.
    6. Updates PaymentRequest status to APPROVED.

    Args:
        request_id: PaymentRequest UUID.
        approver_id: Approver User UUID.
        comment: Optional approver remarks or notes.
        approved_amount: Optional adjusted approved amount.
        ip: Client IP address.
        user_agent: Client user-agent string.
        db: Active AsyncSession database session.

    Returns:
        The created immutable ApprovalRecord.

    Raises:
        HTTPException: 403 Forbidden on Separation of Duties or authorization failure,
                       400 Bad Request if status is not PENDING_APPROVAL,
                       404 Not Found if request does not exist.
    """
    parsed_req_id = request_id if isinstance(request_id, uuid.UUID) else uuid.UUID(str(request_id))
    parsed_approver_id = (
        approver_id if isinstance(approver_id, uuid.UUID) else uuid.UUID(str(approver_id))
    )

    # Fetch request with eager-loaded relations
    stmt = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
            selectinload(PaymentRequest.company),
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.vendor),
        )
        .where(
            PaymentRequest.id == parsed_req_id,
            PaymentRequest.is_deleted.is_(False),
        )
    )
    result = await db.execute(stmt)
    req = result.scalar_one_or_none()

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PaymentRequest with ID '{parsed_req_id}' not found.",
        )

    # CRITICAL RULE 1: Separation of Duties - cannot approve own request
    if req.requested_by_id == parsed_approver_id:
        logger.error(
            "Self-approval attempt blocked: user %s attempted to approve request #%s",
            parsed_approver_id,
            req.request_number,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Approver CANNOT approve their own payment requests. "
                "Separation of Duties (SoD) anti-fraud policy strictly violated."
            ),
        )

    # CRITICAL RULE 2: Only PENDING_APPROVAL status can be approved
    if req.status != PaymentStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot approve payment request #{req.request_number} with status '{req.status.value}'. "
                "Only requests currently in PENDING_APPROVAL status can be approved."
            ),
        )

    # CRITICAL RULE 3: Only assigned approver can approve (or authorized director/super_admin)
    approver = await db.get(User, parsed_approver_id)
    if not approver or not approver.is_active or approver.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Approver account is inactive, locked, or does not exist.",
        )

    # Eagerly load approver role
    if not approver.role:
        stmt_role = select(Role).where(Role.id == approver.role_id)
        role_res = await db.execute(stmt_role)
        approver.role = role_res.scalar_one_or_none()

    approver_role_name = approver.role.name.lower() if approver.role else ""
    is_super_admin = approver_role_name == RoleEnum.SUPER_ADMIN.value
    is_company_director = (
        approver_role_name == RoleEnum.DIRECTOR.value and approver.company_id == req.company_id
    )

    if req.assigned_approver_id != parsed_approver_id and not (is_super_admin or is_company_director):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Access denied: You are not the assigned approver for this payment request, "
                "nor do you possess executive director override authority."
            ),
        )

    # Determine final approved amount
    final_amount = (
        Decimal(str(approved_amount))
        if approved_amount is not None
        else req.total_amount
    )
    if final_amount <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Approved amount must be greater than zero.",
        )

    # CRITICAL RULE 4: Create immutable ApprovalRecord
    approval_record = ApprovalRecord(
        payment_request_id=req.id,
        approver_id=parsed_approver_id,
        status=ApprovalStatus.APPROVED,
        comment=str(comment).strip() if comment else None,
        original_amount=req.total_amount,
        approved_amount=final_amount,
        ip_address=str(ip)[:45] if ip else None,
        user_agent=str(user_agent)[:500] if user_agent else None,
    )
    db.add(approval_record)

    # CRITICAL RULE 5: Update PaymentRequest state
    prev_status = req.status.value
    req.status = PaymentStatus.APPROVED
    req.approved_at = datetime.now(timezone.utc)
    if final_amount != req.total_amount:
        req.total_amount = final_amount
        if comment:
            req.remarks = f"{req.remarks or ''}\n[Approved with adjusted amount: {final_amount}]"

    await db.flush()

    # CRITICAL RULE 6: Send notifications on approval
    # 6a. In-app notification to requester
    await create_notification(
        user_id=req.requested_by_id,
        title=f"Payment Request Approved: #{req.request_number}",
        message=(
            f"Your Payment Request #{req.request_number} for {req.total_amount} "
            f"has been APPROVED by {approver.full_name}."
        ),
        type=NotificationType.PAYMENT_APPROVED,
        entity_type="payment_request",
        entity_id=req.id,
        db=db,
    )

    # 6b. Email notification to requester
    email_body = (
        f"Dear {req.requested_by.first_name if req.requested_by else 'Colleague'},\n\n"
        f"Your Payment Request #{req.request_number} has been APPROVED.\n\n"
        f"Amount Approved: {final_amount}\n"
        f"Approved By: {approver.full_name}\n"
        f"Approver Comments: {comment or 'None'}\n\n"
        f"The voucher has been forwarded to the Accounts department for disbursement processing.\n"
    )
    await send_email_notification(
        user_id=req.requested_by_id,
        subject=f"[{req.company.name if req.company else 'MV'}] Payment Request #{req.request_number} Approved",
        body=email_body,
        db=db,
    )

    # 6c. In-app notification to accountants for disbursement
    stmt_acc = (
        select(User)
        .join(User.role)
        .where(
            User.company_id == req.company_id,
            User.is_active.is_(True),
            User.is_deleted.is_(False),
            Role.name == RoleEnum.ACCOUNTANT.value,
        )
    )
    acc_res = await db.execute(stmt_acc)
    accountants = acc_res.scalars().all()
    for acc in accountants:
        await create_notification(
            user_id=acc.id,
            title=f"Approved Payment Ready for Processing: #{req.request_number}",
            message=f"Payment Request #{req.request_number} ({final_amount}) has been approved and is ready for payment disbursement.",
            type=NotificationType.INFO,
            entity_type="payment_request",
            entity_id=req.id,
            db=db,
        )

    # Audit logging
    await log_event(
        user_id=parsed_approver_id,
        event_type=AuditEventType.PAYMENT_REQUEST_APPROVED,
        entity_type="payment_request",
        entity_id=req.id,
        previous_value={"status": prev_status, "amount": float(req.total_amount)},
        new_value={
            "status": PaymentStatus.APPROVED.value,
            "approved_amount": float(final_amount),
            "approver_id": str(parsed_approver_id),
            "comment": comment,
        },
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return approval_record


async def reject_request(
    request_id: Union[uuid.UUID, str],
    approver_id: Union[uuid.UUID, str],
    reason: str,
    ip: Optional[str],
    user_agent: Optional[str],
    db: AsyncSession,
) -> ApprovalRecord:
    """
    Rejects a payment request and records justification in immutable ApprovalRecord.

    Args:
        request_id: PaymentRequest UUID.
        approver_id: Approver User UUID.
        reason: Mandatory rejection justification.
        ip: Client IP address.
        user_agent: Client user-agent string.
        db: Active AsyncSession database session.

    Returns:
        The created immutable ApprovalRecord.

    Raises:
        HTTPException: 400 Bad Request on empty reason or invalid status, 404 if not found.
    """
    if not reason or not str(reason).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A detailed reason is required to reject a payment request.",
        )

    parsed_req_id = request_id if isinstance(request_id, uuid.UUID) else uuid.UUID(str(request_id))
    parsed_approver_id = (
        approver_id if isinstance(approver_id, uuid.UUID) else uuid.UUID(str(approver_id))
    )

    stmt = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
            selectinload(PaymentRequest.company),
            selectinload(PaymentRequest.vendor),
        )
        .where(
            PaymentRequest.id == parsed_req_id,
            PaymentRequest.is_deleted.is_(False),
        )
    )
    result = await db.execute(stmt)
    req = result.scalar_one_or_none()

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PaymentRequest with ID '{parsed_req_id}' not found.",
        )

    # Status validation: can only reject requests pending review
    if req.status not in (PaymentStatus.PENDING_APPROVAL, PaymentStatus.SUBMITTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject payment request in '{req.status.value}' status.",
        )

    # Verify approver
    approver = await db.get(User, parsed_approver_id)
    if not approver or not approver.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Approver is inactive or unauthorized.",
        )

    # Create immutable ApprovalRecord
    clean_reason = str(reason).strip()
    approval_record = ApprovalRecord(
        payment_request_id=req.id,
        approver_id=parsed_approver_id,
        status=ApprovalStatus.REJECTED,
        comment=clean_reason,
        original_amount=req.total_amount,
        approved_amount=Decimal("0.00"),
        ip_address=str(ip)[:45] if ip else None,
        user_agent=str(user_agent)[:500] if user_agent else None,
    )
    db.add(approval_record)

    # Update PaymentRequest
    prev_status = req.status.value
    req.status = PaymentStatus.REJECTED
    req.rejected_at = datetime.now(timezone.utc)
    await db.flush()

    # Send notifications
    await create_notification(
        user_id=req.requested_by_id,
        title=f"Payment Request Rejected: #{req.request_number}",
        message=f"Your Payment Request #{req.request_number} was REJECTED by {approver.full_name}. Reason: {clean_reason}",
        type=NotificationType.PAYMENT_REJECTED,
        entity_type="payment_request",
        entity_id=req.id,
        db=db,
    )

    try:
        await send_rejection_notification(
            request=req,
            reason=clean_reason,
            recipient_email=req.requested_by.email if req.requested_by else None,
        )
    except Exception as exc:
        logger.error("Failed to send rejection email for request %s: %s", req.request_number, exc)

    # Audit logging
    await log_event(
        user_id=parsed_approver_id,
        event_type=AuditEventType.PAYMENT_REQUEST_REJECTED,
        entity_type="payment_request",
        entity_id=req.id,
        previous_value={"status": prev_status},
        new_value={
            "status": PaymentStatus.REJECTED.value,
            "approver_id": str(parsed_approver_id),
            "reason": clean_reason,
        },
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return approval_record


async def request_clarification(
    request_id: Union[uuid.UUID, str],
    approver_id: Union[uuid.UUID, str],
    message: str,
    db: AsyncSession,
) -> ClarificationMessage:
    """
    Submits a clarification request message from the approver to the requester.
    Transitions request status to CLARIFICATION_REQUIRED.

    Args:
        request_id: PaymentRequest UUID.
        approver_id: Approver User UUID.
        message: The inquiry or clarification request content.
        db: Active AsyncSession database session.

    Returns:
        The created ClarificationMessage model instance.

    Raises:
        HTTPException: 400 Bad Request if message is empty, 404 if not found.
    """
    clean_message = str(message).strip()
    if not clean_message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Clarification inquiry message cannot be empty.",
        )

    parsed_req_id = request_id if isinstance(request_id, uuid.UUID) else uuid.UUID(str(request_id))
    parsed_approver_id = (
        approver_id if isinstance(approver_id, uuid.UUID) else uuid.UUID(str(approver_id))
    )

    stmt = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
            selectinload(PaymentRequest.vendor),
        )
        .where(
            PaymentRequest.id == parsed_req_id,
            PaymentRequest.is_deleted.is_(False),
        )
    )
    result = await db.execute(stmt)
    req = result.scalar_one_or_none()

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PaymentRequest with ID '{parsed_req_id}' not found.",
        )

    # Create ClarificationMessage
    clarification_msg = ClarificationMessage(
        payment_request_id=req.id,
        sender_id=parsed_approver_id,
        message=clean_message,
        is_response=False,
    )
    db.add(clarification_msg)

    # Update PaymentRequest status
    prev_status = req.status.value
    req.status = PaymentStatus.CLARIFICATION_REQUIRED
    await db.flush()

    # Create in-app notification for requester
    await create_notification(
        user_id=req.requested_by_id,
        title=f"Clarification Requested: #{req.request_number}",
        message=f"The approver requested clarification on Payment Request #{req.request_number}: '{clean_message}'",
        type=NotificationType.CLARIFICATION_REQUESTED,
        entity_type="payment_request",
        entity_id=req.id,
        db=db,
    )

    # Send async email
    try:
        await send_clarification_notification(
            request=req,
            message=clean_message,
            recipient_email=req.requested_by.email if req.requested_by else None,
        )
    except Exception as exc:
        logger.error("Failed to send clarification email for request %s: %s", req.request_number, exc)

    # Audit logging
    await log_event(
        user_id=parsed_approver_id,
        event_type=AuditEventType.PAYMENT_REQUEST_CLARIFICATION_REQUESTED,
        entity_type="payment_request",
        entity_id=req.id,
        previous_value={"status": prev_status},
        new_value={
            "status": PaymentStatus.CLARIFICATION_REQUIRED.value,
            "message": clean_message,
        },
        ip=None,
        user_agent=None,
        db=db,
    )

    return clarification_msg


async def respond_to_clarification(
    request_id: Union[uuid.UUID, str],
    user_id: Union[uuid.UUID, str],
    message: str,
    db: AsyncSession,
) -> ClarificationMessage:
    """
    Submits a requester's response to an outstanding clarification question.
    Reverts status back to PENDING_APPROVAL.

    Args:
        request_id: PaymentRequest UUID.
        user_id: Responding User UUID.
        message: Clarification reply text.
        db: Active AsyncSession database session.

    Returns:
        The created ClarificationMessage model instance.

    Raises:
        HTTPException: 400 Bad Request on empty message or invalid status, 404 if not found.
    """
    clean_message = str(message).strip()
    if not clean_message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Clarification response message cannot be empty.",
        )

    parsed_req_id = request_id if isinstance(request_id, uuid.UUID) else uuid.UUID(str(request_id))
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

    stmt = select(PaymentRequest).where(
        PaymentRequest.id == parsed_req_id,
        PaymentRequest.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    req = result.scalar_one_or_none()

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PaymentRequest with ID '{parsed_req_id}' not found.",
        )

    # Record message
    clarification_msg = ClarificationMessage(
        payment_request_id=req.id,
        sender_id=parsed_user_id,
        message=clean_message,
        is_response=True,
    )
    db.add(clarification_msg)

    # Revert status to PENDING_APPROVAL
    prev_status = req.status.value
    req.status = PaymentStatus.PENDING_APPROVAL
    await db.flush()

    # Notify approver that clarification was provided
    if req.assigned_approver_id:
        await create_notification(
            user_id=req.assigned_approver_id,
            title=f"Clarification Provided: #{req.request_number}",
            message=f"Requester has replied to the inquiry on Payment Request #{req.request_number}: '{clean_message}'",
            type=NotificationType.CLARIFICATION_PROVIDED,
            entity_type="payment_request",
            entity_id=req.id,
            db=db,
        )

    # Audit logging
    await log_event(
        user_id=parsed_user_id,
        event_type=AuditEventType.PAYMENT_REQUEST_CLARIFICATION_RESPONDED,
        entity_type="payment_request",
        entity_id=req.id,
        previous_value={"status": prev_status},
        new_value={
            "status": PaymentStatus.PENDING_APPROVAL.value,
            "response": clean_message,
        },
        ip=None,
        user_agent=None,
        db=db,
    )

    return clarification_msg


async def get_pending_approvals(
    approver_id: Union[uuid.UUID, str],
    filters: Optional[Union[Dict[str, Any], Any]],
    pagination: Optional[Union[Dict[str, Any], Any]],
    db: AsyncSession,
) -> PaginatedResponse[PaymentRequest]:
    """
    Retrieves requests pending approval assigned to the designated approver.

    Args:
        approver_id: Approver User UUID.
        filters: Filter criteria dictionary or schema.
        pagination: Pagination dictionary or schema.
        db: Active AsyncSession database session.

    Returns:
        PaginatedResponse of PaymentRequest items.
    """
    parsed_approver_id = (
        approver_id if isinstance(approver_id, uuid.UUID) else uuid.UUID(str(approver_id))
    )

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
            selectinload(PaymentRequest.vendor),
        )
        .where(
            PaymentRequest.assigned_approver_id == parsed_approver_id,
            PaymentRequest.status == PaymentStatus.PENDING_APPROVAL,
            PaymentRequest.is_deleted.is_(False),
        )
    )
    count_query = (
        select(func.count())
        .select_from(PaymentRequest)
        .where(
            PaymentRequest.assigned_approver_id == parsed_approver_id,
            PaymentRequest.status == PaymentStatus.PENDING_APPROVAL,
            PaymentRequest.is_deleted.is_(False),
        )
    )

    if filters:
        f = _extract_dict(filters)

        if f.get("priority"):
            prio = f["priority"]
            parsed_prio = prio if isinstance(prio, PaymentPriority) else PaymentPriority(str(prio).upper())
            query = query.where(PaymentRequest.priority == parsed_prio)
            count_query = count_query.where(PaymentRequest.priority == parsed_prio)

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

        if f.get("search"):
            pat = f"%{str(f['search']).strip().lower()}%"
            search_clause = or_(
                func.lower(PaymentRequest.request_number).ilike(pat),
                func.lower(PaymentRequest.payment_purpose).ilike(pat),
            )
            query = query.where(search_clause)
            count_query = count_query.where(search_clause)

    total_res = await db.execute(count_query)
    total = total_res.scalar_one_or_none() or 0

    offset = (page - 1) * page_size
    # Prioritize URGENT and HIGH priority vouchers, then chronological
    query = (
        query.order_by(
            PaymentRequest.priority.desc(),
            PaymentRequest.submitted_at.asc(),
        )
        .offset(offset)
        .limit(page_size)
    )
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


async def get_approval_history(
    request_id: Union[uuid.UUID, str],
    db: AsyncSession,
) -> Dict[str, Any]:
    """
    Retrieves the complete historical audit thread for a payment request,
    including formal approval/rejection decisions and clarification dialogues.

    Args:
        request_id: PaymentRequest UUID.
        db: Active AsyncSession database session.

    Returns:
        Dictionary containing approval_records and clarification_messages.
    """
    parsed_id = request_id if isinstance(request_id, uuid.UUID) else uuid.UUID(str(request_id))

    # Fetch approval records
    stmt_approvals = (
        select(ApprovalRecord)
        .options(selectinload(ApprovalRecord.approver))
        .where(ApprovalRecord.payment_request_id == parsed_id)
        .order_by(ApprovalRecord.created_at.asc())
    )
    res_approvals = await db.execute(stmt_approvals)
    approvals = list(res_approvals.scalars().all())

    # Fetch clarification messages
    stmt_messages = (
        select(ClarificationMessage)
        .options(selectinload(ClarificationMessage.sender))
        .where(ClarificationMessage.payment_request_id == parsed_id)
        .order_by(ClarificationMessage.created_at.asc())
    )
    res_messages = await db.execute(stmt_messages)
    messages = list(res_messages.scalars().all())

    return {
        "payment_request_id": str(parsed_id),
        "approval_records": approvals,
        "clarification_messages": messages,
    }

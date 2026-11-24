"""
Payment Execution & Disbursement API Router.

Implements accounting disbursement execution and confirmation:
- POST /api/payments/{request_id}/record - Record disbursement metadata (UTR, Cheque, Bank)
- POST /api/payments/{request_id}/complete - Mark payment workflow as fully completed
- GET /api/payments/{request_id} - Fetch disbursement confirmation details

ENFORCEMENT:
- Payment can only be recorded for payment requests in APPROVED status.
- Restricted to Accountant or Super Administrator roles.
"""

from datetime import datetime, timezone
from decimal import Decimal
import logging
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.middleware.rate_limit import get_client_ip
from app.models.audit_log import AuditEventType, AuditLog
from app.models.document import PaymentRequestDocument
from app.models.notification import Notification, NotificationType
from app.models.payment_record import PaymentRecord
from app.models.payment_request import PaymentMode, PaymentRequest, PaymentStatus
from app.models.role import RoleEnum
from app.models.user import User

logger = logging.getLogger("mv-payment-approval.api.payments")

router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
    dependencies=[Depends(require_role(RoleEnum.SUPER_ADMIN, RoleEnum.ACCOUNTANT))],
)


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class PaidByInfo(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str

    model_config = {"from_attributes": True}


class PaymentRecordResponse(BaseModel):
    id: uuid.UUID
    payment_request_id: uuid.UUID
    paid_by_id: uuid.UUID
    paid_by: Optional[PaidByInfo] = None
    payment_date: datetime
    actual_amount: Decimal
    payment_mode: PaymentMode
    bank_account: Optional[str] = None
    transaction_id: Optional[str] = None
    utr_number: Optional[str] = None
    cheque_number: Optional[str] = None
    payment_reference: Optional[str] = None
    payment_remarks: Optional[str] = None
    proof_document_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RecordPaymentRequest(BaseModel):
    payment_date: Optional[datetime] = None
    actual_amount: Decimal = Field(..., gt=0, description="Actual disbursed net amount")
    payment_mode: PaymentMode = PaymentMode.NEFT
    bank_account: Optional[str] = Field(None, description="Disbursing company bank account number")
    transaction_id: Optional[str] = None
    utr_number: Optional[str] = Field(None, description="Unique Transaction Reference (UTR) from bank")
    cheque_number: Optional[str] = None
    payment_reference: Optional[str] = Field(None, description="Internal ERP / Voucher number")
    payment_remarks: Optional[str] = None
    proof_document_id: Optional[uuid.UUID] = None


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

@router.post(
    "/{request_id}/record",
    response_model=PaymentRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record Payment Execution",
    description="Records payment disbursement details (UTR, transaction ID, bank info). Can only be executed for APPROVED requests.",
)
async def record_payment(
    request_id: uuid.UUID,
    payload_in: RecordPaymentRequest,
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

    # STRICT ENFORCEMENT: Can only record payment for APPROVED requests
    if payment_req.status != PaymentStatus.APPROVED and payment_req.status != PaymentStatus.PAYMENT_PROCESSING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot record payment for request with status '{payment_req.status.value}'. Must be APPROVED.",
        )

    # Validate proof document if provided
    if payload_in.proof_document_id:
        doc_q = select(PaymentRequestDocument).where(
            PaymentRequestDocument.id == payload_in.proof_document_id,
            PaymentRequestDocument.payment_request_id == request_id,
            PaymentRequestDocument.is_deleted == False,
        )
        doc_res = await db.execute(doc_q)
        if not doc_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid proof_document_id associated with this payment request.",
            )

    pay_date = payload_in.payment_date or datetime.now(timezone.utc)

    payment_record = PaymentRecord(
        payment_request_id=payment_req.id,
        paid_by_id=current_user.id,
        payment_date=pay_date,
        actual_amount=payload_in.actual_amount,
        payment_mode=payload_in.payment_mode,
        bank_account=payload_in.bank_account,
        transaction_id=payload_in.transaction_id,
        utr_number=payload_in.utr_number,
        cheque_number=payload_in.cheque_number,
        payment_reference=payload_in.payment_reference,
        payment_remarks=payload_in.payment_remarks,
        proof_document_id=payload_in.proof_document_id,
    )
    db.add(payment_record)

    # Update request lifecycle state
    payment_req.status = PaymentStatus.PAID
    payment_req.paid_at = pay_date

    # Notify requester of disbursement
    notif = Notification(
        user_id=payment_req.requested_by_id,
        title=f"Payment Disbursed: {payment_req.request_number}",
        message=(
            f"Payment of {payload_in.actual_amount} for request '{payment_req.request_number}' "
            f"has been executed. UTR: {payload_in.utr_number or 'N/A'}."
        ),
        type=NotificationType.PAYMENT_PROCESSED,
        entity_type="payment_request",
        entity_id=payment_req.id,
    )
    db.add(notif)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type=AuditEventType.PAYMENT_RECORDED,
        entity_type="payment_record",
        entity_id=payment_record.id,
        new_value={
            "actual_amount": str(payload_in.actual_amount),
            "utr_number": payload_in.utr_number,
            "status": PaymentStatus.PAID.value,
        },
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    # Re-query with paid_by loaded
    full_q = (
        select(PaymentRecord)
        .options(selectinload(PaymentRecord.paid_by))
        .where(PaymentRecord.id == payment_record.id)
    )
    full_res = await db.execute(full_q)
    return PaymentRecordResponse.model_validate(full_res.scalar_one())


@router.post(
    "/{request_id}/complete",
    response_model=PaymentRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark Payment As Completed",
    description="Closes out the payment lifecycle after reconciliation.",
)
async def complete_payment(
    request_id: uuid.UUID,
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

    if payment_req.status != PaymentStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot complete request with status '{payment_req.status.value}'. Must be PAID.",
        )

    payment_req.status = PaymentStatus.COMPLETED
    payment_req.completed_at = datetime.now(timezone.utc)

    audit = AuditLog(
        user_id=current_user.id,
        event_type=AuditEventType.PAYMENT_COMPLETED,
        entity_type="payment_request",
        entity_id=payment_req.id,
        new_value={"status": PaymentStatus.COMPLETED.value},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    # Fetch corresponding payment record
    rec_q = (
        select(PaymentRecord)
        .options(selectinload(PaymentRecord.paid_by))
        .where(PaymentRecord.payment_request_id == request_id)
        .order_by(PaymentRecord.created_at.desc())
    )
    rec_res = await db.execute(rec_q)
    record = rec_res.scalars().first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disbursement record not found for this request.",
        )

    return PaymentRecordResponse.model_validate(record)


@router.get(
    "/{request_id}",
    response_model=PaymentRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Payment Disbursement Record",
    description="Retrieves execution and UTR details for the specified payment request.",
)
async def get_payment_record(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(PaymentRecord)
        .options(selectinload(PaymentRecord.paid_by))
        .where(PaymentRecord.payment_request_id == request_id)
        .order_by(PaymentRecord.created_at.desc())
    )
    result = await db.execute(query)
    record = result.scalars().first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No payment record found for request ID '{request_id}'.",
        )

    return PaymentRecordResponse.model_validate(record)

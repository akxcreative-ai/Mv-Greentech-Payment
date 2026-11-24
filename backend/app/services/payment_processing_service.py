"""
Payment Processing Service for MV Payment Approval System.
Handles recording disbursement execution (UTR, bank transactions) and final workflow completion.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Optional, Union
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit_log import AuditEventType
from app.models.notification import NotificationType
from app.models.payment_record import PaymentRecord
from app.models.payment_request import PaymentMode, PaymentRequest, PaymentStatus
from app.services import audit_service, notification_service


def _extract_dict(data: Union[Any, Dict[str, Any]]) -> Dict[str, Any]:
    """Helper to convert Pydantic schema or dictionary into a dict."""
    if hasattr(data, "model_dump"):
        return data.model_dump(exclude_unset=True)
    if hasattr(data, "dict"):
        return data.dict(exclude_unset=True)
    if isinstance(data, dict):
        return data.copy()
    raise ValueError(f"Unsupported data type for extraction: {type(data)}")


async def record_payment(
    request_id: Union[str, uuid.UUID],
    data: Union[Any, Dict[str, Any]],
    user_id: Union[str, uuid.UUID],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> PaymentRecord:
    """
    Record payment disbursement for an approved payment request.
    
    CRITICAL:
    Can only record payment for requests with status APPROVED.
    Rejects execution if request is in any other status.
    """
    req_uuid = uuid.UUID(str(request_id)) if not isinstance(request_id, uuid.UUID) else request_id
    usr_uuid = uuid.UUID(str(user_id)) if not isinstance(user_id, uuid.UUID) else user_id

    # 1. Fetch payment request
    query = (
        select(PaymentRequest)
        .where(PaymentRequest.id == req_uuid)
        .options(
            selectinload(PaymentRequest.company),
            selectinload(PaymentRequest.vendor),
            selectinload(PaymentRequest.requested_by),
        )
    )
    result = await db.execute(query)
    payment_request = result.scalar_one_or_none()

    if not payment_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment request with ID {request_id} not found."
        )

    # 2. Verify status is APPROVED
    if payment_request.status != PaymentStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot record payment for request {payment_request.request_number} with status "
                f"'{payment_request.status.value}'. Payment can only be recorded for APPROVED requests."
            ),
        )

    # 3. Extract and sanitize payment execution data
    payload = _extract_dict(data)

    actual_amount = payload.get("actual_amount")
    if actual_amount is not None:
        actual_amount = Decimal(str(actual_amount))
    else:
        actual_amount = payment_request.total_amount

    payment_date = payload.get("payment_date")
    if not payment_date:
        payment_date = datetime.now(timezone.utc)
    elif isinstance(payment_date, str):
        payment_date = datetime.fromisoformat(payment_date)

    payment_mode_raw = payload.get("payment_mode", payment_request.payment_mode)
    if isinstance(payment_mode_raw, str):
        try:
            payment_mode = PaymentMode(payment_mode_raw)
        except ValueError:
            payment_mode = PaymentMode.NEFT
    else:
        payment_mode = payment_mode_raw or PaymentMode.NEFT

    bank_account = payload.get("bank_account", payment_request.bank_account)
    transaction_id = payload.get("transaction_id")
    utr_number = payload.get("utr_number")
    cheque_number = payload.get("cheque_number")
    payment_reference = payload.get("payment_reference")
    payment_remarks = payload.get("payment_remarks")
    
    proof_doc_id = payload.get("proof_document_id")
    if proof_doc_id:
        proof_doc_id = uuid.UUID(str(proof_doc_id)) if not isinstance(proof_doc_id, uuid.UUID) else proof_doc_id

    # 4. Create PaymentRecord
    record = PaymentRecord(
        payment_request_id=payment_request.id,
        paid_by_id=usr_uuid,
        payment_date=payment_date,
        actual_amount=actual_amount,
        payment_mode=payment_mode,
        bank_account=bank_account,
        transaction_id=transaction_id,
        utr_number=utr_number,
        cheque_number=cheque_number,
        payment_reference=payment_reference,
        payment_remarks=payment_remarks,
        proof_document_id=proof_doc_id,
    )
    db.add(record)

    # 5. Transition payment request state to PAID
    previous_status = payment_request.status.value
    payment_request.status = PaymentStatus.PAID
    payment_request.paid_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(record)
    await db.refresh(payment_request)

    # 6. Audit Logging
    await audit_service.log_event(
        user_id=usr_uuid,
        event_type=AuditEventType.PAYMENT_RECORDED,
        entity_type="payment_record",
        entity_id=record.id,
        previous_value={
            "request_status": previous_status,
        },
        new_value={
            "payment_request_id": str(payment_request.id),
            "request_number": payment_request.request_number,
            "status": payment_request.status.value,
            "actual_amount": str(record.actual_amount),
            "payment_mode": record.payment_mode.value,
            "utr_number": record.utr_number,
            "transaction_id": record.transaction_id,
            "payment_date": record.payment_date.isoformat(),
        },
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    # 7. Notify Requester
    await notification_service.create_notification(
        user_id=payment_request.requested_by_id,
        title="Payment Disbursed",
        message=(
            f"Payment for request {payment_request.request_number} ({payment_request.payment_purpose[:40]}...) "
            f"amounting to {record.actual_amount} has been disbursed via {record.payment_mode.value}. "
            f"UTR / Ref: {record.utr_number or record.transaction_id or record.payment_reference or 'N/A'}."
        ),
        type=NotificationType.PAYMENT_PROCESSED,
        entity_type="payment_request",
        entity_id=payment_request.id,
        db=db,
    )

    return record


async def mark_completed(
    request_id: Union[str, uuid.UUID],
    user_id: Union[str, uuid.UUID],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> PaymentRequest:
    """
    Mark a disbursed (PAID) payment request as COMPLETED once bank reconciliations
    or receipt confirmations are finalized.
    """
    req_uuid = uuid.UUID(str(request_id)) if not isinstance(request_id, uuid.UUID) else request_id
    usr_uuid = uuid.UUID(str(user_id)) if not isinstance(user_id, uuid.UUID) else user_id

    query = (
        select(PaymentRequest)
        .where(PaymentRequest.id == req_uuid)
        .options(
            selectinload(PaymentRequest.company),
            selectinload(PaymentRequest.vendor),
            selectinload(PaymentRequest.requested_by),
        )
    )
    result = await db.execute(query)
    payment_request = result.scalar_one_or_none()

    if not payment_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment request with ID {request_id} not found."
        )

    if payment_request.status == PaymentStatus.COMPLETED:
        return payment_request

    if payment_request.status != PaymentStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot complete request {payment_request.request_number} with status "
                f"'{payment_request.status.value}'. Request must be in PAID status before completion."
            ),
        )

    previous_status = payment_request.status.value
    payment_request.status = PaymentStatus.COMPLETED
    payment_request.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(payment_request)

    # Audit Logging
    await audit_service.log_event(
        user_id=usr_uuid,
        event_type=AuditEventType.PAYMENT_COMPLETED,
        entity_type="payment_request",
        entity_id=payment_request.id,
        previous_value={"status": previous_status},
        new_value={
            "status": payment_request.status.value,
            "completed_at": payment_request.completed_at.isoformat(),
        },
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    # Notify Requester
    await notification_service.create_notification(
        user_id=payment_request.requested_by_id,
        title="Payment Request Completed",
        message=(
            f"Payment request {payment_request.request_number} has been finalized and marked as COMPLETED."
        ),
        type=NotificationType.INFO,
        entity_type="payment_request",
        entity_id=payment_request.id,
        db=db,
    )

    return payment_request


async def get_payment_record(
    request_id: Union[str, uuid.UUID],
    db: AsyncSession,
) -> PaymentRecord:
    """
    Retrieve the payment execution record associated with a payment request.
    """
    req_uuid = uuid.UUID(str(request_id)) if not isinstance(request_id, uuid.UUID) else request_id

    query = (
        select(PaymentRecord)
        .where(PaymentRecord.payment_request_id == req_uuid)
        .options(
            selectinload(PaymentRecord.paid_by),
            selectinload(PaymentRecord.proof_document),
            selectinload(PaymentRecord.payment_request),
        )
        .order_by(PaymentRecord.created_at.desc())
    )
    result = await db.execute(query)
    record = result.scalars().first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No payment execution record found for payment request {request_id}."
        )

    return record

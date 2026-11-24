"""
Payment Execution & Banking Disbursement Test Suite.

Verifies:
- Recording payment disbursement for approved requests
- Enforcement: Strictly forbidding disbursements for unapproved/draft requests
- Reconciliation: Marking paid requests as COMPLETED
- Integrity of disbursement record fields (UTR, banking info, executor identity)
"""

from datetime import datetime, timezone
from decimal import Decimal
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment_request import PaymentRequest, PaymentStatus
from app.models.user import User


@pytest.mark.asyncio
async def test_record_payment_for_approved_request(
    test_client: AsyncClient,
    test_db: AsyncSession,
    accountant_headers: dict,
    approved_payment_request: PaymentRequest,
    accountant_user: User,
):
    """
    Ensure the accountant can record disbursement details for an APPROVED request.
    """
    payload = {
        "actual_amount": 59000.0,
        "payment_mode": "NEFT",
        "bank_account": "50200012345678",
        "transaction_id": "TXN-987654321",
        "utr_number": "HDFCR52026030100123456",
        "payment_remarks": "Executed via HDFC Corporate Portal",
    }

    response = await test_client.post(
        f"/api/payments/{approved_payment_request.id}/record",
        headers=accountant_headers,
        json=payload,
    )
    assert response.status_code == 201
    data = response.json()
    assert float(data["actual_amount"]) == 59000.0
    assert data["utr_number"] == "HDFCR52026030100123456"
    assert data["transaction_id"] == "TXN-987654321"
    assert data["paid_by"]["id"] == str(accountant_user.id)

    # Verify DB state updated to PAID
    await test_db.refresh(approved_payment_request)
    assert approved_payment_request.status == PaymentStatus.PAID
    assert approved_payment_request.paid_at is not None


@pytest.mark.asyncio
async def test_cannot_record_payment_for_unapproved_request(
    test_client: AsyncClient,
    accountant_headers: dict,
    pending_payment_request: PaymentRequest,
    draft_payment_request: PaymentRequest,
):
    """
    Ensure disbursements cannot be executed for requests in DRAFT or PENDING_APPROVAL.
    """
    payload = {
        "actual_amount": 29500.0,
        "payment_mode": "NEFT",
        "bank_account": "50200012345678",
        "utr_number": "ILLEGAL-UTR-1234",
    }

    # 1. PENDING_APPROVAL request attempt -> 400
    pend_resp = await test_client.post(
        f"/api/payments/{pending_payment_request.id}/record",
        headers=accountant_headers,
        json=payload,
    )
    assert pend_resp.status_code == 400
    assert "must be approved" in pend_resp.json().get("message", "").lower()

    # 2. DRAFT request attempt -> 400
    draft_resp = await test_client.post(
        f"/api/payments/{draft_payment_request.id}/record",
        headers=accountant_headers,
        json=payload,
    )
    assert draft_resp.status_code == 400
    assert "must be approved" in draft_resp.json().get("message", "").lower()


@pytest.mark.asyncio
async def test_mark_completed(
    test_client: AsyncClient,
    test_db: AsyncSession,
    accountant_headers: dict,
    approved_payment_request: PaymentRequest,
):
    """
    Ensure a request in PAID status can be closed out as COMPLETED,
    while un-disbursed requests cannot.
    """
    # 1. Attempting to mark un-paid request as completed -> 400
    fail_resp = await test_client.post(
        f"/api/payments/{approved_payment_request.id}/complete",
        headers=accountant_headers,
    )
    assert fail_resp.status_code == 400
    assert "must be paid" in fail_resp.json().get("message", "").lower()

    # 2. Disburse payment to reach PAID state
    pay_resp = await test_client.post(
        f"/api/payments/{approved_payment_request.id}/record",
        headers=accountant_headers,
        json={
            "actual_amount": 59000.0,
            "payment_mode": "RTGS",
            "bank_account": "50200012345678",
            "utr_number": "UTR-COMP-9999",
        },
    )
    assert pay_resp.status_code == 201

    # 3. Mark completed succeeds
    comp_resp = await test_client.post(
        f"/api/payments/{approved_payment_request.id}/complete",
        headers=accountant_headers,
    )
    assert comp_resp.status_code == 200

    # Verify DB status
    await test_db.refresh(approved_payment_request)
    assert approved_payment_request.status == PaymentStatus.COMPLETED
    assert approved_payment_request.completed_at is not None


@pytest.mark.asyncio
async def test_payment_record_fields(
    test_client: AsyncClient,
    accountant_headers: dict,
    approved_payment_request: PaymentRequest,
    accountant_user: User,
):
    """
    Ensure the retrieved payment record contains all expected attributes and schema types.
    """
    # Disburse payment
    record_payload = {
        "actual_amount": 59000.0,
        "payment_mode": "NEFT",
        "bank_account": "50200012345678",
        "transaction_id": "TXN-FIELD-TEST-001",
        "utr_number": "UTR-FIELD-TEST-001",
        "payment_reference": "REF-VOUCHER-001",
        "payment_remarks": "Complete field audit test",
    }
    create_resp = await test_client.post(
        f"/api/payments/{approved_payment_request.id}/record",
        headers=accountant_headers,
        json=record_payload,
    )
    assert create_resp.status_code == 201

    # Query details
    get_resp = await test_client.get(
        f"/api/payments/{approved_payment_request.id}",
        headers=accountant_headers,
    )
    assert get_resp.status_code == 200
    data = get_resp.json()

    assert data["payment_request_id"] == str(approved_payment_request.id)
    assert data["paid_by_id"] == str(accountant_user.id)
    assert data["paid_by"]["email"] == accountant_user.email
    assert float(data["actual_amount"]) == 59000.0
    assert data["payment_mode"] == "NEFT"
    assert data["bank_account"] == "50200012345678"
    assert data["transaction_id"] == "TXN-FIELD-TEST-001"
    assert data["utr_number"] == "UTR-FIELD-TEST-001"
    assert data["payment_reference"] == "REF-VOUCHER-001"
    assert data["payment_remarks"] == "Complete field audit test"
    assert "payment_date" in data
    assert "created_at" in data

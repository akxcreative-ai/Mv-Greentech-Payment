"""
Payment Approval Workflow & Maker-Checker Separation Test Suite.

Verifies:
- Approval transition and status updates
- Rejection requiring mandatory justification
- Clarification request and response workflow loop
- Status constraints (only PENDING_APPROVAL requests can be acted upon)
- Maker-Checker separation (users cannot approve own requests)
- Designee constraint (only assigned approver or super admin can approve)
- Immutable audit trail of approval decisions
- Prevention of editing approved requests without re-approval workflow
- Prevention of bypassing approval gates via API
"""

from datetime import datetime, timezone
from decimal import Decimal
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.approval import ApprovalRecord, ApprovalStatus
from app.models.company import Company
from app.models.department import Department
from app.models.payment_request import (
    ExpenseCategory,
    PaymentMode,
    PaymentPriority,
    PaymentRequest,
    PaymentStatus,
)
from app.models.user import User
from app.models.vendor import Vendor


@pytest.mark.asyncio
async def test_approve_request(
    test_client: AsyncClient,
    test_db: AsyncSession,
    director_headers: dict,
    pending_payment_request: PaymentRequest,
    director_user: User,
):
    """
    Ensure the designated approver can approve a pending payment request.
    """
    response = await test_client.post(
        f"/api/approvals/{pending_payment_request.id}/approve",
        headers=director_headers,
        json={"comment": "Approved for payment execution", "approved_amount": 29500.0},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "APPROVED"
    assert data["comment"] == "Approved for payment execution"
    assert data["approver"]["id"] == str(director_user.id)

    # Verify DB state
    await test_db.refresh(pending_payment_request)
    assert pending_payment_request.status == PaymentStatus.APPROVED
    assert pending_payment_request.approved_at is not None


@pytest.mark.asyncio
async def test_reject_request_requires_reason(
    test_client: AsyncClient,
    test_db: AsyncSession,
    director_headers: dict,
    pending_payment_request: PaymentRequest,
):
    """
    Ensure rejecting a payment request strictly requires a non-empty reason.
    """
    # 1. Missing or too short reason fails validation
    invalid_resp = await test_client.post(
        f"/api/approvals/{pending_payment_request.id}/reject",
        headers=director_headers,
        json={"reason": "bad"},
    )
    assert invalid_resp.status_code == 422

    # 2. Valid reason succeeds
    valid_resp = await test_client.post(
        f"/api/approvals/{pending_payment_request.id}/reject",
        headers=director_headers,
        json={"reason": "Invoice pricing exceeds negotiated agreement."},
    )
    assert valid_resp.status_code == 200
    data = valid_resp.json()
    assert data["status"] == "REJECTED"

    # Verify DB state
    await test_db.refresh(pending_payment_request)
    assert pending_payment_request.status == PaymentStatus.REJECTED
    assert pending_payment_request.rejected_at is not None


@pytest.mark.asyncio
async def test_request_clarification(
    test_client: AsyncClient,
    test_db: AsyncSession,
    director_headers: dict,
    pending_payment_request: PaymentRequest,
):
    """
    Ensure an approver can request clarification, moving status to CLARIFICATION_REQUIRED.
    """
    response = await test_client.post(
        f"/api/approvals/{pending_payment_request.id}/clarify",
        headers=director_headers,
        json={"message": "Please attach the signed timesheets for these contractors."},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "Please attach the signed timesheets for these contractors."
    assert data["is_response"] is False

    # Verify DB state
    await test_db.refresh(pending_payment_request)
    assert pending_payment_request.status == PaymentStatus.CLARIFICATION_REQUIRED


@pytest.mark.asyncio
async def test_respond_to_clarification(
    test_client: AsyncClient,
    test_db: AsyncSession,
    director_headers: dict,
    regular_user_headers: dict,
    pending_payment_request: PaymentRequest,
):
    """
    Ensure the requester can respond to clarification, transitioning status back to PENDING_APPROVAL.
    """
    # 1. Approver asks for clarification
    await test_client.post(
        f"/api/approvals/{pending_payment_request.id}/clarify",
        headers=director_headers,
        json={"message": "Clarify invoice tax breakdown please."},
    )

    # 2. Requester responds
    response = await test_client.post(
        f"/api/approvals/{pending_payment_request.id}/respond",
        headers=regular_user_headers,
        json={"message": "Tax breakdown revised and uploaded as requested."},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "Tax breakdown revised and uploaded as requested."
    assert data["is_response"] is True

    # Verify DB transitioned back to PENDING_APPROVAL
    await test_db.refresh(pending_payment_request)
    assert pending_payment_request.status == PaymentStatus.PENDING_APPROVAL


@pytest.mark.asyncio
async def test_cannot_approve_without_pending_status(
    test_client: AsyncClient,
    director_headers: dict,
    draft_payment_request: PaymentRequest,
):
    """
    Ensure requests not in PENDING_APPROVAL status (e.g. DRAFT) cannot be approved.
    """
    response = await test_client.post(
        f"/api/approvals/{draft_payment_request.id}/approve",
        headers=director_headers,
        json={"comment": "Attempting to approve draft."},
    )
    assert response.status_code == 400
    data = response.json()
    assert "must be pending_approval" in data.get("message", "").lower()


@pytest.mark.asyncio
async def test_cannot_approve_own_request(
    test_client: AsyncClient,
    test_db: AsyncSession,
    director_headers: dict,
    test_company: Company,
    test_department: Department,
    test_vendor: Vendor,
    director_user: User,
):
    """
    Ensure Maker-Checker enforcement: Approver cannot approve a request they initiated.
    """
    req = PaymentRequest(
        id=uuid.uuid4(),
        request_number=f"PR-{uuid.uuid4().hex[:6].upper()}",
        company_id=test_company.id,
        department_id=test_department.id,
        requested_by_id=director_user.id,
        vendor_id=test_vendor.id,
        expense_category=ExpenseCategory.TRAVEL,
        payment_purpose="Director travel conference ticket",
        amount=Decimal("30000.00"),
        gst_amount=Decimal("5400.00"),
        total_amount=Decimal("35400.00"),
        payment_mode=PaymentMode.NEFT,
        bank_account="1234567890",
        priority=PaymentPriority.HIGH,
        status=PaymentStatus.PENDING_APPROVAL,
        assigned_approver_id=director_user.id,
        submitted_at=datetime.now(timezone.utc),
    )
    test_db.add(req)
    await test_db.commit()

    response = await test_client.post(
        f"/api/approvals/{req.id}/approve",
        headers=director_headers,
        json={"comment": "Self-approval attempt"},
    )
    assert response.status_code == 403
    data = response.json()
    assert "maker-checker" in data.get("message", "").lower()


@pytest.mark.asyncio
async def test_only_assigned_approver_can_approve(
    test_client: AsyncClient,
    department_head_headers: dict,
    super_admin_headers: dict,
    pending_payment_request: PaymentRequest,
):
    """
    Ensure a user who is not the assigned approver cannot approve,
    while a Super Administrator possesses authorization override.
    """
    # 1. Department Head (not the assigned approver) attempts approval -> 403
    unauth_resp = await test_client.post(
        f"/api/approvals/{pending_payment_request.id}/approve",
        headers=department_head_headers,
        json={"comment": "Wrong approver approving."},
    )
    assert unauth_resp.status_code == 403
    data = unauth_resp.json()
    assert "not the designated approver" in data.get("message", "").lower()

    # 2. Super Admin can approve via administrator privilege
    admin_resp = await test_client.post(
        f"/api/approvals/{pending_payment_request.id}/approve",
        headers=super_admin_headers,
        json={"comment": "Super Admin override approval."},
    )
    assert admin_resp.status_code == 200
    assert admin_resp.json()["status"] == "APPROVED"


@pytest.mark.asyncio
async def test_approval_creates_immutable_record(
    test_client: AsyncClient,
    director_headers: dict,
    pending_payment_request: PaymentRequest,
    director_user: User,
):
    """
    Ensure approving a request generates an immutable audit record retrievable via history.
    """
    # 1. Approve
    approve_resp = await test_client.post(
        f"/api/approvals/{pending_payment_request.id}/approve",
        headers=director_headers,
        json={"comment": "Verified against purchase order.", "approved_amount": 29500.0},
    )
    assert approve_resp.status_code == 200

    # 2. Retrieve history audit trail
    history_resp = await test_client.get(
        f"/api/approvals/{pending_payment_request.id}/history",
        headers=director_headers,
    )
    assert history_resp.status_code == 200
    data = history_resp.json()
    records = data["approval_records"]
    assert len(records) >= 1
    rec = records[0]
    assert rec["status"] == "APPROVED"
    assert rec["comment"] == "Verified against purchase order."
    assert rec["approver"]["id"] == str(director_user.id)
    assert float(rec["approved_amount"]) == 29500.0


@pytest.mark.asyncio
async def test_editing_approved_request_requires_reapproval(
    test_client: AsyncClient,
    regular_user_headers: dict,
    approved_payment_request: PaymentRequest,
):
    """
    Ensure once a request is APPROVED, it cannot be modified via PUT endpoint.
    Modifications require workflow re-initiation.
    """
    response = await test_client.put(
        f"/api/payment-requests/{approved_payment_request.id}",
        headers=regular_user_headers,
        json={"amount": 99999.0, "remarks": "Unauthorized modification after approval"},
    )
    assert response.status_code == 400
    data = response.json()
    assert "only draft requests can be updated" in data.get("message", "").lower()


@pytest.mark.asyncio
async def test_cannot_bypass_approval_via_api(
    test_client: AsyncClient,
    regular_user_headers: dict,
    accountant_headers: dict,
    draft_payment_request: PaymentRequest,
):
    """
    Ensure malicious clients cannot bypass the approval gate:
    - Cannot record payment for DRAFT requests
    - Cannot mark payment COMPLETED directly
    - Cannot tamper with status via update payloads
    """
    # 1. Attempt to execute payment for unapproved draft request -> 400
    pay_resp = await test_client.post(
        f"/api/payments/{draft_payment_request.id}/record",
        headers=accountant_headers,
        json={
            "actual_amount": 17700.0,
            "payment_mode": "NEFT",
            "bank_account": "50200012345678",
            "utr_number": "UTR1234567890",
        },
    )
    assert pay_resp.status_code == 400
    assert "must be approved" in pay_resp.json().get("message", "").lower()

    # 2. Attempt to mark completed directly -> 400
    complete_resp = await test_client.post(
        f"/api/payments/{draft_payment_request.id}/complete",
        headers=accountant_headers,
    )
    assert complete_resp.status_code == 400

    # 3. Attempt to inject status: APPROVED in draft update payload
    update_resp = await test_client.put(
        f"/api/payment-requests/{draft_payment_request.id}",
        headers=regular_user_headers,
        json={"remarks": "Harmless update", "status": "APPROVED"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["status"] == "DRAFT"

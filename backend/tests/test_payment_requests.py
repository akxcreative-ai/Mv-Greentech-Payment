"""
Payment Request Lifecycle & Validation Test Suite.

Verifies:
- Creation of draft payment requests with tax and totals computation
- Editing allowed for draft requests and forbidden for submitted requests
- Submission requiring tiered approval workflow vs auto-approval below threshold
- Cancellation workflow
- Duplicate invoice number detection per vendor
- Document uploads with strict magic-bytes verification
- Rejection of invalid file extensions and oversized files (> 10MB)
"""

from datetime import datetime, timezone
from decimal import Decimal
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.department import Department
from app.models.payment_request import (
    ExpenseCategory,
    PaymentMode,
    PaymentPriority,
    PaymentRequest,
    PaymentStatus,
)
from app.models.role import RoleEnum
from app.models.settings import ApprovalRule
from app.models.user import User
from app.models.vendor import Vendor


@pytest.mark.asyncio
async def test_create_request(
    test_client: AsyncClient,
    regular_user_headers: dict,
    test_company: Company,
    test_department: Department,
    test_vendor: Vendor,
):
    """
    Ensure a user can create a valid payment request in DRAFT status.
    """
    payload = {
        "company_id": str(test_company.id),
        "department_id": str(test_department.id),
        "vendor_id": str(test_vendor.id),
        "expense_category": "VENDOR_PAYMENT",
        "expense_subcategory": "Cloud Software",
        "payment_purpose": "Quarterly cloud hosting infrastructure",
        "invoice_number": f"INV-{uuid.uuid4().hex[:6].upper()}",
        "invoice_date": datetime.now(timezone.utc).isoformat(),
        "due_date": datetime.now(timezone.utc).isoformat(),
        "amount": 50000.0,
        "gst_amount": 9000.0,
        "payment_mode": "NEFT",
        "priority": "NORMAL",
        "bank_account": "50200012345678",
        "remarks": "Standard payment processing",
    }

    response = await test_client.post(
        "/api/payment-requests",
        headers=regular_user_headers,
        json=payload,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "DRAFT"
    assert float(data["amount"]) == 50000.0
    assert float(data["gst_amount"]) == 9000.0
    assert float(data["total_amount"]) == 59000.0
    assert data["request_number"].startswith("PR-")
    assert data["payment_purpose"] == "Quarterly cloud hosting infrastructure"


@pytest.mark.asyncio
async def test_update_draft_request(
    test_client: AsyncClient,
    regular_user_headers: dict,
    draft_payment_request: PaymentRequest,
):
    """
    Ensure a payment request in DRAFT status can be updated.
    """
    update_payload = {
        "amount": 20000.0,
        "remarks": "Adjusted budget amount",
    }

    response = await test_client.put(
        f"/api/payment-requests/{draft_payment_request.id}",
        headers=regular_user_headers,
        json=update_payload,
    )
    assert response.status_code == 200
    data = response.json()
    assert float(data["amount"]) == 20000.0
    assert float(data["total_amount"]) == 20000.0 + float(draft_payment_request.gst_amount)
    assert data["remarks"] == "Adjusted budget amount"


@pytest.mark.asyncio
async def test_cannot_update_submitted_request(
    test_client: AsyncClient,
    regular_user_headers: dict,
    pending_payment_request: PaymentRequest,
):
    """
    Ensure requests that have already been submitted cannot be updated.
    """
    response = await test_client.put(
        f"/api/payment-requests/{pending_payment_request.id}",
        headers=regular_user_headers,
        json={"amount": 99999.0},
    )
    assert response.status_code == 400
    data = response.json()
    assert "only draft requests can be updated" in data.get("message", "").lower()


@pytest.mark.asyncio
async def test_submit_request_requires_approval(
    test_client: AsyncClient,
    test_db: AsyncSession,
    regular_user_headers: dict,
    test_company: Company,
    test_department: Department,
    test_vendor: Vendor,
    regular_user: User,
    director_user: User,
):
    """
    When request total exceeds the auto-approval threshold, submitting it
    must transition the request to PENDING_APPROVAL.
    """
    # Create rule: amounts > 10,000 require approval by director
    rule = ApprovalRule(
        id=uuid.uuid4(),
        company_id=test_company.id,
        min_amount=Decimal("10000.01"),
        max_amount=None,
        approver_role=RoleEnum.DIRECTOR.value,
        requires_approval=True,
        is_active=True,
    )
    test_db.add(rule)

    req = PaymentRequest(
        id=uuid.uuid4(),
        request_number=f"PR-{uuid.uuid4().hex[:6].upper()}",
        company_id=test_company.id,
        department_id=test_department.id,
        requested_by_id=regular_user.id,
        vendor_id=test_vendor.id,
        expense_category=ExpenseCategory.VENDOR_PAYMENT,
        payment_purpose="High-value server hardware purchase",
        amount=Decimal("75000.00"),
        gst_amount=Decimal("13500.00"),
        total_amount=Decimal("88500.00"),
        payment_mode=PaymentMode.RTGS,
        bank_account="1234567890",
        priority=PaymentPriority.HIGH,
        status=PaymentStatus.DRAFT,
        assigned_approver_id=director_user.id,
    )
    test_db.add(req)
    await test_db.commit()

    response = await test_client.post(
        f"/api/payment-requests/{req.id}/submit",
        headers=regular_user_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PENDING_APPROVAL"


@pytest.mark.asyncio
async def test_submit_request_below_threshold(
    test_client: AsyncClient,
    test_db: AsyncSession,
    regular_user_headers: dict,
    test_company: Company,
    test_department: Department,
    test_vendor: Vendor,
    regular_user: User,
):
    """
    When request amount is below the company threshold (requires_approval = False),
    submitting it should automatically approve the request.
    """
    # Create rule: amounts <= 10,000 do NOT require approval
    rule = ApprovalRule(
        id=uuid.uuid4(),
        company_id=test_company.id,
        min_amount=Decimal("0.00"),
        max_amount=Decimal("10000.00"),
        approver_role=RoleEnum.DEPARTMENT_HEAD.value,
        requires_approval=False,
        is_active=True,
    )
    test_db.add(rule)

    req = PaymentRequest(
        id=uuid.uuid4(),
        request_number=f"PR-{uuid.uuid4().hex[:6].upper()}",
        company_id=test_company.id,
        department_id=test_department.id,
        requested_by_id=regular_user.id,
        vendor_id=test_vendor.id,
        expense_category=ExpenseCategory.OFFICE_EXPENSES,
        payment_purpose="Small office stationery supply",
        amount=Decimal("3000.00"),
        gst_amount=Decimal("540.00"),
        total_amount=Decimal("3540.00"),
        payment_mode=PaymentMode.NEFT,
        bank_account="1234567890",
        priority=PaymentPriority.LOW,
        status=PaymentStatus.DRAFT,
    )
    test_db.add(req)
    await test_db.commit()

    response = await test_client.post(
        f"/api/payment-requests/{req.id}/submit",
        headers=regular_user_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "APPROVED"


@pytest.mark.asyncio
async def test_cancel_request(
    test_client: AsyncClient,
    regular_user_headers: dict,
    draft_payment_request: PaymentRequest,
):
    """
    Ensure a payment request can be cancelled by the requester.
    """
    response = await test_client.post(
        f"/api/payment-requests/{draft_payment_request.id}/cancel",
        headers=regular_user_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "CANCELLED"


@pytest.mark.asyncio
async def test_duplicate_detection(
    test_client: AsyncClient,
    test_db: AsyncSession,
    regular_user_headers: dict,
    test_company: Company,
    test_department: Department,
    test_vendor: Vendor,
    regular_user: User,
):
    """
    Ensure the system identifies duplicate requests with matching invoice number and vendor.
    """
    invoice_no = f"INV-DUP-{uuid.uuid4().hex[:6].upper()}"

    # Request 1 (Existing active request)
    req1 = PaymentRequest(
        id=uuid.uuid4(),
        request_number=f"PR-{uuid.uuid4().hex[:6].upper()}",
        company_id=test_company.id,
        department_id=test_department.id,
        requested_by_id=regular_user.id,
        vendor_id=test_vendor.id,
        expense_category=ExpenseCategory.VENDOR_PAYMENT,
        payment_purpose="First submission for invoice",
        invoice_number=invoice_no,
        amount=Decimal("12000.00"),
        gst_amount=Decimal("2160.00"),
        total_amount=Decimal("14160.00"),
        payment_mode=PaymentMode.NEFT,
        bank_account="1234567890",
        priority=PaymentPriority.NORMAL,
        status=PaymentStatus.PENDING_APPROVAL,
    )
    test_db.add(req1)

    # Request 2 (Duplicate draft attempting the same invoice)
    req2 = PaymentRequest(
        id=uuid.uuid4(),
        request_number=f"PR-{uuid.uuid4().hex[:6].upper()}",
        company_id=test_company.id,
        department_id=test_department.id,
        requested_by_id=regular_user.id,
        vendor_id=test_vendor.id,
        expense_category=ExpenseCategory.VENDOR_PAYMENT,
        payment_purpose="Duplicate submission for invoice",
        invoice_number=invoice_no,
        amount=Decimal("12000.00"),
        gst_amount=Decimal("2160.00"),
        total_amount=Decimal("14160.00"),
        payment_mode=PaymentMode.NEFT,
        bank_account="1234567890",
        priority=PaymentPriority.NORMAL,
        status=PaymentStatus.DRAFT,
    )
    test_db.add(req2)
    await test_db.commit()

    response = await test_client.post(
        f"/api/payment-requests/{req2.id}/check-duplicate",
        headers=regular_user_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_duplicate"] is True
    assert data["matching_count"] >= 1
    assert any(m["id"] == str(req1.id) for m in data["matches"])


@pytest.mark.asyncio
async def test_document_upload(
    test_client: AsyncClient,
    regular_user_headers: dict,
    draft_payment_request: PaymentRequest,
):
    """
    Ensure supporting documents with valid magic bytes (e.g. PDF) are accepted.
    """
    valid_pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    files = {
        "file": ("invoice_signed.pdf", valid_pdf_content, "application/pdf"),
    }

    response = await test_client.post(
        f"/api/payment-requests/{draft_payment_request.id}/documents",
        headers=regular_user_headers,
        files=files,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["original_name"] == "invoice_signed.pdf"
    assert data["file_size"] > 0
    assert "file_name" in data
    assert "id" in data


@pytest.mark.asyncio
async def test_invalid_file_type_rejected(
    test_client: AsyncClient,
    regular_user_headers: dict,
    draft_payment_request: PaymentRequest,
):
    """
    Ensure executable files or files with mismatched extensions are rejected.
    """
    # 1. Disallowed extension (.exe)
    bad_file = {
        "file": ("exploit.exe", b"MZ\x90\x00\x03\x00\x00\x00", "application/x-msdownload"),
    }
    response = await test_client.post(
        f"/api/payment-requests/{draft_payment_request.id}/documents",
        headers=regular_user_headers,
        files=bad_file,
    )
    assert response.status_code == 400
    data = response.json()
    assert "not permitted" in data.get("message", "").lower()

    # 2. Fake PDF with wrong magic bytes (.pdf extension but random text content)
    fake_pdf = {
        "file": ("fake_invoice.pdf", b"Hello this is not a real PDF at all", "application/pdf"),
    }
    response2 = await test_client.post(
        f"/api/payment-requests/{draft_payment_request.id}/documents",
        headers=regular_user_headers,
        files=fake_pdf,
    )
    assert response2.status_code == 400
    data2 = response2.json()
    assert "does not match the expected format" in data2.get("message", "").lower()


@pytest.mark.asyncio
async def test_file_size_limit(
    test_client: AsyncClient,
    regular_user_headers: dict,
    draft_payment_request: PaymentRequest,
):
    """
    Ensure files exceeding 10MB limit are rejected with HTTP 400.
    """
    # Generate 10MB + 1KB content starting with PDF magic bytes
    oversized_content = b"%PDF-1.4" + b"0" * (10 * 1024 * 1024 + 1024)
    files = {
        "file": ("large_invoice.pdf", oversized_content, "application/pdf"),
    }

    response = await test_client.post(
        f"/api/payment-requests/{draft_payment_request.id}/documents",
        headers=regular_user_headers,
        files=files,
    )
    assert response.status_code == 400
    data = response.json()
    assert "exceeds" in data.get("message", "").lower() or "limit" in data.get("message", "").lower()

"""
Role-Based Access Control (RBAC) & Authorization Test Suite.

Verifies:
- Segregation of duties (Accountants cannot approve requests)
- Maker-Checker policy enforcement (Approvers cannot approve own requests)
- Admin configuration restrictions (Unauthorized roles cannot access system settings)
- User management restrictions (Only Super Admin can manage user records)
- Role-based dashboard authorization matrix (Admin vs Accountant vs Approver)
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
from app.models.user import User
from app.models.vendor import Vendor


@pytest.mark.asyncio
async def test_accountant_cannot_approve(
    test_client: AsyncClient,
    accountant_headers: dict,
    pending_payment_request: PaymentRequest,
):
    """
    Ensure an accountant cannot sign off or approve a payment request.
    Only the assigned approver or super admin can approve.
    """
    response = await test_client.post(
        f"/api/approvals/{pending_payment_request.id}/approve",
        headers=accountant_headers,
        json={"comment": "Unauthorized accountant attempt to approve."},
    )
    assert response.status_code == 403
    data = response.json()
    assert "designated approver" in data.get("message", "").lower() or "forbidden" in str(data).lower()


@pytest.mark.asyncio
async def test_approver_cannot_approve_own_request(
    test_client: AsyncClient,
    test_db: AsyncSession,
    test_company: Company,
    test_department: Department,
    test_vendor: Vendor,
    director_user: User,
    director_headers: dict,
):
    """
    Ensure Maker-Checker policy: An approver who creates a payment request
    is strictly barred from approving their own request.
    """
    # Create request where requester and assigned approver are the director
    req = PaymentRequest(
        id=uuid.uuid4(),
        request_number=f"PR-{uuid.uuid4().hex[:6].upper()}",
        company_id=test_company.id,
        department_id=test_department.id,
        requested_by_id=director_user.id,
        vendor_id=test_vendor.id,
        expense_category=ExpenseCategory.TRAVEL,
        payment_purpose="Director executive travel reimbursement",
        amount=Decimal("45000.00"),
        gst_amount=Decimal("0.00"),
        total_amount=Decimal("45000.00"),
        payment_mode=PaymentMode.NEFT,
        bank_account="1234567890",
        priority=PaymentPriority.HIGH,
        status=PaymentStatus.PENDING_APPROVAL,
        assigned_approver_id=director_user.id,
        submitted_at=datetime.now(timezone.utc),
    )
    test_db.add(req)
    await test_db.commit()
    await test_db.refresh(req)

    # Director attempts to approve own request
    response = await test_client.post(
        f"/api/approvals/{req.id}/approve",
        headers=director_headers,
        json={"comment": "Attempting to approve my own request."},
    )
    assert response.status_code == 403
    data = response.json()
    assert "maker-checker" in data.get("message", "").lower()


@pytest.mark.asyncio
async def test_unauthorized_user_cannot_access_admin(
    test_client: AsyncClient,
    regular_user_headers: dict,
    accountant_headers: dict,
    super_admin_headers: dict,
):
    """
    Ensure non-administrative users are blocked from accessing system configuration.
    """
    # 1. Regular user trying to read system settings
    reg_resp = await test_client.get(
        "/api/settings",
        headers=regular_user_headers,
    )
    assert reg_resp.status_code == 403

    # 2. Accountant trying to mutate approval rules
    acc_resp = await test_client.post(
        "/api/settings/approval-rules",
        headers=accountant_headers,
        json={
            "company_id": str(uuid.uuid4()),
            "min_amount": 0.0,
            "max_amount": 5000.0,
            "approver_role": "accountant",
            "requires_approval": False,
        },
    )
    assert acc_resp.status_code == 403

    # 3. Super admin succeeds
    admin_resp = await test_client.get(
        "/api/settings",
        headers=super_admin_headers,
    )
    assert admin_resp.status_code == 200


@pytest.mark.asyncio
async def test_accountant_cannot_access_user_management(
    test_client: AsyncClient,
    accountant_headers: dict,
    super_admin_headers: dict,
):
    """
    Ensure accountant role cannot list, modify, or create users in user management.
    """
    # 1. Accountant listing users
    list_resp = await test_client.get(
        "/api/users",
        headers=accountant_headers,
    )
    assert list_resp.status_code == 403

    # 2. Accountant creating a user
    create_resp = await test_client.post(
        "/api/users",
        headers=accountant_headers,
        json={
            "email": "intruder@mvcorp.com",
            "password": "Password123!",
            "first_name": "Intruder",
            "last_name": "User",
            "role_id": str(uuid.uuid4()),
            "company_id": str(uuid.uuid4()),
        },
    )
    assert create_resp.status_code == 403

    # 3. Super admin listing users succeeds
    admin_resp = await test_client.get(
        "/api/users",
        headers=super_admin_headers,
    )
    assert admin_resp.status_code == 200


@pytest.mark.asyncio
async def test_role_based_dashboard_access(
    test_client: AsyncClient,
    super_admin_headers: dict,
    director_headers: dict,
    accountant_headers: dict,
    regular_user_headers: dict,
):
    """
    Verify role-based isolation of executive, accountant, and approver dashboard views.
    """
    # 1. Admin Dashboard (/api/reports/dashboard/admin)
    # Permitted: Super Admin, Director
    resp = await test_client.get("/api/reports/dashboard/admin", headers=super_admin_headers)
    assert resp.status_code == 200

    resp = await test_client.get("/api/reports/dashboard/admin", headers=director_headers)
    assert resp.status_code == 200

    # Denied: Accountant, Requester
    resp = await test_client.get("/api/reports/dashboard/admin", headers=accountant_headers)
    assert resp.status_code == 403

    resp = await test_client.get("/api/reports/dashboard/admin", headers=regular_user_headers)
    assert resp.status_code == 403

    # 2. Accountant Dashboard (/api/reports/dashboard/accountant)
    # Permitted: Super Admin, Accountant
    resp = await test_client.get("/api/reports/dashboard/accountant", headers=accountant_headers)
    assert resp.status_code == 200

    resp = await test_client.get("/api/reports/dashboard/accountant", headers=super_admin_headers)
    assert resp.status_code == 200

    # Denied: Regular Requester
    resp = await test_client.get("/api/reports/dashboard/accountant", headers=regular_user_headers)
    assert resp.status_code == 403

    # 3. Approver Dashboard (/api/reports/dashboard/approver)
    # Accessible to authenticated users with approver duties
    resp = await test_client.get("/api/reports/dashboard/approver", headers=director_headers)
    assert resp.status_code == 200

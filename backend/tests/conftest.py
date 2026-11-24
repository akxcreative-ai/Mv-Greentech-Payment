"""
Test Configuration and Fixtures for MV Payment Approval System Backend.

Configures:
- In-memory Async SQLite database with StaticPool for fast, isolated test execution
- Table creation and migration schema loading
- FastAPI application test client using httpx.AsyncClient with ASGITransport
- Pre-seeded system roles, test organization, departments, and vendors
- Role-based user fixtures (super_admin, director, accountant, department_head, regular requester)
- Authorization bearer headers for each role
- Helper data creation factories
- SlowAPI rate limiter auto-reset per test
"""

import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from typing import AsyncGenerator, Dict, Optional
import uuid

import pytest
import pytest_asyncio
import httpx
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.api.setup import ensure_default_roles
from app.database import get_db
from app.main import app as fastapi_app
from app.middleware.rate_limit import limiter
from app.models.approval import ApprovalRecord, ApprovalStatus, ClarificationMessage
from app.models.base import Base
import app.models  # Ensure all model tables are registered in Base.metadata
from app.models.company import Company
from app.models.department import Department
from app.models.payment_request import (
    ExpenseCategory,
    PaymentMode,
    PaymentPriority,
    PaymentRequest,
    PaymentStatus,
)
from app.models.role import Role, RoleEnum
from app.models.settings import ApprovalRule, SystemSettings
from app.models.user import User
from app.models.vendor import Vendor
from app.utils.security import create_access_token, hash_password

TEST_PASSWORD = "TestPassword123!"
# Pre-computed Argon2 hash for speed across fixtures
PRECOMPUTED_HASH = hash_password(TEST_PASSWORD)


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset SlowAPI limiter state before and after each test."""
    try:
        limiter.reset()
    except Exception:
        pass
    yield
    try:
        limiter.reset()
    except Exception:
        pass


@pytest_asyncio.fixture(scope="session")
async def async_engine() -> AsyncGenerator[AsyncEngine, None]:
    """
    Creates an asynchronous SQLite in-memory engine with StaticPool.
    """
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def test_db(async_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """
    Yields an active AsyncSession bound to a clean test database.
    Creates all tables before the test and drops all tables after.
    """
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )
    async with session_factory() as session:
        yield session

    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def test_roles(test_db: AsyncSession) -> Dict[str, Role]:
    """
    Ensures standard system roles (super_admin, director, accountant, department_head) exist.
    """
    roles_map = await ensure_default_roles(test_db)
    await test_db.commit()
    return roles_map


@pytest_asyncio.fixture
async def test_company(test_db: AsyncSession) -> Company:
    """Creates a standard test Company entity."""
    company = Company(
        id=uuid.uuid4(),
        name="MV Corp Technologies Ltd",
        code="MV-TECH",
        address="123 Corporate Park, Tech Hub",
        phone="+91 9876543210",
        email="finance@mvcorp.com",
        gst_number="27AAACM1234F1Z5",
        pan_number="AAACM1234F",
        is_active=True,
    )
    test_db.add(company)
    await test_db.commit()
    await test_db.refresh(company)
    return company


@pytest_asyncio.fixture
async def test_department(test_db: AsyncSession, test_company: Company) -> Department:
    """Creates a standard test Department entity within test_company."""
    dept = Department(
        id=uuid.uuid4(),
        name="Finance & Accounts",
        code="FIN",
        company_id=test_company.id,
        is_active=True,
    )
    test_db.add(dept)
    await test_db.commit()
    await test_db.refresh(dept)
    return dept


@pytest_asyncio.fixture
async def test_vendor(test_db: AsyncSession, test_company: Company) -> Vendor:
    """Creates a standard test Vendor entity."""
    vendor = Vendor(
        id=uuid.uuid4(),
        name="Acme Cloud Solutions Pvt Ltd",
        code="VEND-ACME",
        company_id=test_company.id,
        contact_person="Alice Vendor",
        email="billing@acmecloud.com",
        phone="+91 9123456789",
        pan_number="ABCDE1234F",
        gst_number="27ABCDE1234F1Z5",
        bank_name="HDFC Bank",
        bank_account_number="50200012345678",
        bank_ifsc="HDFC0001234",
        bank_branch="BKC Mumbai",
        is_active=True,
    )
    test_db.add(vendor)
    await test_db.commit()
    await test_db.refresh(vendor)
    return vendor


@pytest_asyncio.fixture
async def super_admin_user(
    test_db: AsyncSession, test_roles: Dict[str, Role], test_company: Company
) -> User:
    """Creates a Super Admin user."""
    user = User(
        id=uuid.uuid4(),
        email="superadmin@mvcorp.com",
        password_hash=PRECOMPUTED_HASH,
        first_name="Super",
        last_name="Admin",
        role_id=test_roles[RoleEnum.SUPER_ADMIN.value].id,
        company_id=test_company.id,
        is_active=True,
        is_locked=False,
        email_verified=True,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest_asyncio.fixture
async def director_user(
    test_db: AsyncSession, test_roles: Dict[str, Role], test_company: Company
) -> User:
    """Creates a Director (Executive Approver) user."""
    user = User(
        id=uuid.uuid4(),
        email="director@mvcorp.com",
        password_hash=PRECOMPUTED_HASH,
        first_name="Devin",
        last_name="Director",
        role_id=test_roles[RoleEnum.DIRECTOR.value].id,
        company_id=test_company.id,
        is_active=True,
        is_locked=False,
        email_verified=True,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest_asyncio.fixture
async def accountant_user(
    test_db: AsyncSession,
    test_roles: Dict[str, Role],
    test_company: Company,
    test_department: Department,
) -> User:
    """Creates an Accountant (Disbursement Execution) user."""
    user = User(
        id=uuid.uuid4(),
        email="accountant@mvcorp.com",
        password_hash=PRECOMPUTED_HASH,
        first_name="Arthur",
        last_name="Accountant",
        role_id=test_roles[RoleEnum.ACCOUNTANT.value].id,
        company_id=test_company.id,
        department_id=test_department.id,
        is_active=True,
        is_locked=False,
        email_verified=True,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest_asyncio.fixture
async def department_head_user(
    test_db: AsyncSession,
    test_roles: Dict[str, Role],
    test_company: Company,
    test_department: Department,
) -> User:
    """Creates a Department Head user and assigns as head of test_department."""
    user = User(
        id=uuid.uuid4(),
        email="depthead@mvcorp.com",
        password_hash=PRECOMPUTED_HASH,
        first_name="Diana",
        last_name="DeptHead",
        role_id=test_roles[RoleEnum.DEPARTMENT_HEAD.value].id,
        company_id=test_company.id,
        department_id=test_department.id,
        is_active=True,
        is_locked=False,
        email_verified=True,
    )
    test_db.add(user)
    await test_db.flush()

    # Assign user as department head
    test_department.head_id = user.id
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest_asyncio.fixture
async def regular_user(
    test_db: AsyncSession,
    test_roles: Dict[str, Role],
    test_company: Company,
    test_department: Department,
) -> User:
    """Creates a regular departmental employee (Requester) user."""
    user = User(
        id=uuid.uuid4(),
        email="requester@mvcorp.com",
        password_hash=PRECOMPUTED_HASH,
        first_name="Ron",
        last_name="Requester",
        role_id=test_roles[RoleEnum.DEPARTMENT_HEAD.value].id,
        company_id=test_company.id,
        department_id=test_department.id,
        is_active=True,
        is_locked=False,
        email_verified=True,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest.fixture
def super_admin_headers(super_admin_user: User) -> Dict[str, str]:
    """Bearer authorization headers for Super Admin."""
    token = create_access_token(
        data={"sub": str(super_admin_user.id), "email": super_admin_user.email, "role": RoleEnum.SUPER_ADMIN.value}
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def director_headers(director_user: User) -> Dict[str, str]:
    """Bearer authorization headers for Director."""
    token = create_access_token(
        data={"sub": str(director_user.id), "email": director_user.email, "role": RoleEnum.DIRECTOR.value}
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def accountant_headers(accountant_user: User) -> Dict[str, str]:
    """Bearer authorization headers for Accountant."""
    token = create_access_token(
        data={"sub": str(accountant_user.id), "email": accountant_user.email, "role": RoleEnum.ACCOUNTANT.value}
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def department_head_headers(department_head_user: User) -> Dict[str, str]:
    """Bearer authorization headers for Department Head."""
    token = create_access_token(
        data={"sub": str(department_head_user.id), "email": department_head_user.email, "role": RoleEnum.DEPARTMENT_HEAD.value}
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def regular_user_headers(regular_user: User) -> Dict[str, str]:
    """Bearer authorization headers for Regular Requester."""
    token = create_access_token(
        data={"sub": str(regular_user.id), "email": regular_user.email, "role": "requester"}
    )
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def test_client(test_db: AsyncSession) -> AsyncGenerator[httpx.AsyncClient, None]:
    """
    FastAPI test client configured with ASGI transport and dependency overrides.
    """
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield test_db

    fastapi_app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=fastapi_app)

    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

    fastapi_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def default_approval_rules(test_db: AsyncSession, test_company: Company) -> Dict[str, ApprovalRule]:
    """
    Seeds approval rules with thresholds:
    - Tier 1: 0 to 10,000 -> department_head
    - Tier 2: 10,000.01 to infinity -> director
    """
    rule1 = ApprovalRule(
        id=uuid.uuid4(),
        company_id=test_company.id,
        min_amount=Decimal("0.00"),
        max_amount=Decimal("10000.00"),
        approver_role=RoleEnum.DEPARTMENT_HEAD.value,
        requires_approval=True,
        is_active=True,
    )
    rule2 = ApprovalRule(
        id=uuid.uuid4(),
        company_id=test_company.id,
        min_amount=Decimal("10000.01"),
        max_amount=None,
        approver_role=RoleEnum.DIRECTOR.value,
        requires_approval=True,
        is_active=True,
    )
    test_db.add(rule1)
    test_db.add(rule2)
    await test_db.commit()
    await test_db.refresh(rule1)
    await test_db.refresh(rule2)
    return {"low": rule1, "high": rule2}


@pytest_asyncio.fixture
async def draft_payment_request(
    test_db: AsyncSession,
    test_company: Company,
    test_department: Department,
    test_vendor: Vendor,
    regular_user: User,
    director_user: User,
) -> PaymentRequest:
    """Fixture providing a sample PaymentRequest in DRAFT state."""
    req = PaymentRequest(
        id=uuid.uuid4(),
        request_number=f"PR-{uuid.uuid4().hex[:6].upper()}",
        company_id=test_company.id,
        department_id=test_department.id,
        requested_by_id=regular_user.id,
        vendor_id=test_vendor.id,
        expense_category=ExpenseCategory.VENDOR_PAYMENT,
        expense_subcategory="Cloud Infrastructure",
        payment_purpose="Monthly cloud hosting invoice",
        invoice_number=f"INV-{uuid.uuid4().hex[:6].upper()}",
        invoice_date=datetime.now(timezone.utc),
        due_date=datetime.now(timezone.utc),
        amount=Decimal("15000.00"),
        gst_amount=Decimal("2700.00"),
        total_amount=Decimal("17700.00"),
        payment_mode=PaymentMode.NEFT,
        bank_account="50200012345678",
        priority=PaymentPriority.HIGH,
        status=PaymentStatus.DRAFT,
        assigned_approver_id=director_user.id,
    )
    test_db.add(req)
    await test_db.commit()
    await test_db.refresh(req)
    return req


@pytest_asyncio.fixture
async def pending_payment_request(
    test_db: AsyncSession,
    test_company: Company,
    test_department: Department,
    test_vendor: Vendor,
    regular_user: User,
    director_user: User,
) -> PaymentRequest:
    """Fixture providing a sample PaymentRequest in PENDING_APPROVAL state."""
    req = PaymentRequest(
        id=uuid.uuid4(),
        request_number=f"PR-{uuid.uuid4().hex[:6].upper()}",
        company_id=test_company.id,
        department_id=test_department.id,
        requested_by_id=regular_user.id,
        vendor_id=test_vendor.id,
        expense_category=ExpenseCategory.VENDOR_PAYMENT,
        expense_subcategory="Cloud Infrastructure",
        payment_purpose="Annual software licenses",
        invoice_number=f"INV-{uuid.uuid4().hex[:6].upper()}",
        invoice_date=datetime.now(timezone.utc),
        due_date=datetime.now(timezone.utc),
        amount=Decimal("25000.00"),
        gst_amount=Decimal("4500.00"),
        total_amount=Decimal("29500.00"),
        payment_mode=PaymentMode.RTGS,
        bank_account="50200012345678",
        priority=PaymentPriority.URGENT,
        status=PaymentStatus.PENDING_APPROVAL,
        assigned_approver_id=director_user.id,
        submitted_at=datetime.now(timezone.utc),
    )
    test_db.add(req)
    await test_db.commit()
    await test_db.refresh(req)
    return req


@pytest_asyncio.fixture
async def approved_payment_request(
    test_db: AsyncSession,
    test_company: Company,
    test_department: Department,
    test_vendor: Vendor,
    regular_user: User,
    director_user: User,
) -> PaymentRequest:
    """Fixture providing a sample PaymentRequest in APPROVED state."""
    req = PaymentRequest(
        id=uuid.uuid4(),
        request_number=f"PR-{uuid.uuid4().hex[:6].upper()}",
        company_id=test_company.id,
        department_id=test_department.id,
        requested_by_id=regular_user.id,
        vendor_id=test_vendor.id,
        expense_category=ExpenseCategory.PROFESSIONAL_FEES,
        payment_purpose="Security audit engagement",
        invoice_number=f"INV-{uuid.uuid4().hex[:6].upper()}",
        invoice_date=datetime.now(timezone.utc),
        due_date=datetime.now(timezone.utc),
        amount=Decimal("50000.00"),
        gst_amount=Decimal("9000.00"),
        total_amount=Decimal("59000.00"),
        payment_mode=PaymentMode.NEFT,
        bank_account="50200012345678",
        priority=PaymentPriority.NORMAL,
        status=PaymentStatus.APPROVED,
        assigned_approver_id=director_user.id,
        submitted_at=datetime.now(timezone.utc),
        approved_at=datetime.now(timezone.utc),
    )
    test_db.add(req)
    await test_db.commit()
    await test_db.refresh(req)
    return req

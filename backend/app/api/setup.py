"""
System Setup & Initial Bootstrapping API Router.

Provides:
- POST /api/setup/init - One-time initial super administrator and default roles creation.
  STRICTLY DISABLED once any user account exists in the system.
"""

from datetime import datetime
import logging
from typing import Any, Dict, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.rate_limit import get_client_ip
from app.models.audit_log import AuditEventType, AuditLog
from app.models.role import Role, RoleEnum
from app.models.user import User
from app.utils.security import hash_password

logger = logging.getLogger("mv-payment-approval.api.setup")

router = APIRouter(prefix="/setup", tags=["Setup"])


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class InitialSetupRequest(BaseModel):
    email: EmailStr = Field(..., description="Super administrator login email")
    password: str = Field(..., min_length=8, description="Strong administrative password (min 8 chars)")
    first_name: str = Field(..., min_length=1, max_length=100, description="Admin given name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Admin family name")


class RoleMiniResponse(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str

    model_config = {"from_attributes": True}


class InitialSetupResponse(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    full_name: str
    role_id: uuid.UUID
    role: Optional[RoleMiniResponse] = None
    is_active: bool
    created_at: datetime
    message: str = "Initial administrator and system roles configured successfully."

    model_config = {"from_attributes": True}


DEFAULT_ROLES_CONFIG = [
    {
        "name": RoleEnum.SUPER_ADMIN.value,
        "display_name": "Super Administrator",
        "description": "Full administrative privileges across all organizations, users, and financial records.",
        "permissions": {"*": True},
        "is_system_role": True,
    },
    {
        "name": RoleEnum.DIRECTOR.value,
        "display_name": "Director / Executive",
        "description": "Executive authority to approve or reject payment requests across all companies.",
        "permissions": {
            "payment_requests": ["read", "approve", "reject", "clarify"],
            "reports": ["read", "export"],
            "approvals": ["read", "write"],
        },
        "is_system_role": True,
    },
    {
        "name": RoleEnum.ACCOUNTANT.value,
        "display_name": "Accountant / Finance",
        "description": "Financial disbursement execution, UTR logging, and vendor coordinates management.",
        "permissions": {
            "payment_requests": ["read"],
            "payments": ["read", "record", "complete"],
            "vendors": ["read", "create", "bank_details"],
            "reports": ["read", "export"],
        },
        "is_system_role": True,
    },
    {
        "name": RoleEnum.DEPARTMENT_HEAD.value,
        "display_name": "Department Head",
        "description": "Originate department payment vouchers and review departmental requests.",
        "permissions": {
            "payment_requests": ["read", "create", "update", "submit", "cancel", "clarify"],
            "approvals": ["read", "approve", "reject", "clarify"],
        },
        "is_system_role": True,
    },
]


async def ensure_default_roles(db: AsyncSession) -> Dict[str, Role]:
    """Ensures built-in system roles exist, creating any that are missing."""
    roles_map: Dict[str, Role] = {}
    for r_def in DEFAULT_ROLES_CONFIG:
        q = select(Role).where(Role.name == r_def["name"])
        res = await db.execute(q)
        role_obj = res.scalar_one_or_none()
        if not role_obj:
            role_obj = Role(
                name=r_def["name"],
                display_name=r_def["display_name"],
                description=r_def["description"],
                permissions=r_def["permissions"],
                is_system_role=r_def["is_system_role"],
            )
            db.add(role_obj)
            await db.flush()
        roles_map[r_def["name"]] = role_obj
    return roles_map


@router.get(
    "/status",
    summary="Check System Initialization Status",
    description="Returns whether the system has been initialized with an initial administrator.",
)
async def get_setup_status(db: AsyncSession = Depends(get_db)):
    count_q = select(func.count()).select_from(User)
    count_res = await db.execute(count_q)
    total_users = count_res.scalar_one()
    return {"initialized": total_users > 0, "total_users": total_users}


@router.post(
    "/init",
    response_model=InitialSetupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initialize Super Administrator Account",
    description="One-time system bootstrap. Creates core system roles and the initial super administrator. Disabled once users exist.",
)
async def initialize_system(
    payload_in: InitialSetupRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Check if any user already exists in the system
    count_q = select(func.count()).select_from(User)
    count_res = await db.execute(count_q)
    total_users = count_res.scalar_one()

    if total_users > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System is already initialized. The initial setup endpoint is permanently disabled.",
        )

    # 1. Create or verify default system roles
    roles_map = await ensure_default_roles(db)
    super_admin_role = roles_map[RoleEnum.SUPER_ADMIN.value]

    # 2. Create the first super admin user
    email_clean = payload_in.email.lower().strip()
    admin_user = User(
        email=email_clean,
        password_hash=hash_password(payload_in.password),
        first_name=payload_in.first_name.strip(),
        last_name=payload_in.last_name.strip(),
        role_id=super_admin_role.id,
        is_active=True,
        is_locked=False,
        email_verified=True,
    )
    db.add(admin_user)
    await db.flush()

    # 3. Record Audit Log
    audit = AuditLog(
        user_id=admin_user.id,
        event_type=AuditEventType.SYSTEM_EVENT,
        entity_type="system",
        entity_id=admin_user.id,
        new_value={"action": "initial_system_setup", "admin_email": admin_user.email},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    # Reload with role
    re_q = select(User).options(selectinload(User.role)).where(User.id == admin_user.id)
    re_res = await db.execute(re_q)
    created_user = re_res.scalar_one()

    logger.info("Initial super admin '%s' successfully bootstrapped.", created_user.email)

    return InitialSetupResponse(
        id=created_user.id,
        email=created_user.email,
        first_name=created_user.first_name,
        last_name=created_user.last_name,
        full_name=created_user.full_name,
        role_id=created_user.role_id,
        role=RoleMiniResponse.model_validate(created_user.role) if created_user.role else None,
        is_active=created_user.is_active,
        created_at=created_user.created_at,
    )


@router.post("/seed", summary="Seed full demo data (Company, Users, Vendors, Requests)")
async def seed_demo_data():
    try:
        from seed_full_demo import seed_full
        await seed_full()
        return {"status": "success", "message": "Demo data seeded successfully"}
    except Exception as exc:
        logger.error("Seeding failed: %s", exc)
        return {"status": "error", "message": str(exc)}


@router.post("/clean-production", summary="Reset to clean production state (removes all demo requests, vendors and creates clean MV Greentech admin)")
async def clean_production_reset():
    try:
        from sqlalchemy import delete
        from app.database import AsyncSessionLocal, init_db
        from app.models.payment_request import PaymentRequest
        from app.models.approval import ApprovalRecord, ClarificationMessage
        from app.models.payment_record import PaymentRecord
        from app.models.audit_log import AuditLog
        from app.models.vendor import Vendor
        from app.models.user import User
        from app.models.department import Department
        from app.models.company import Company
        from app.models.role import Role, RoleEnum
        from app.utils.security import hash_password

        # Ensure all tables exist first
        await init_db()

        async with AsyncSessionLocal() as db:
            # 1. Safely delete existing records
            for model in [ClarificationMessage, ApprovalRecord, PaymentRecord, PaymentRequest, AuditLog, Vendor, User, Department, Company]:
                try:
                    await db.execute(delete(model))
                except Exception as del_err:
                    logger.warning("Table cleanup skipped for %s: %s", model, del_err)
            await db.flush()

            # 2. Ensure Roles
            roles = {}
            for r_name in [RoleEnum.SUPER_ADMIN, RoleEnum.DIRECTOR, RoleEnum.ACCOUNTANT, RoleEnum.DEPARTMENT_HEAD]:
                q_r = select(Role).where(Role.name == r_name.value)
                res_r = await db.execute(q_r)
                r_obj = res_r.scalar_one_or_none()
                if not r_obj:
                    r_obj = Role(
                        name=r_name.value,
                        display_name=r_name.value.replace("_", " ").title(),
                        description=f"{r_name.value} role",
                        permissions={"*": True} if r_name == RoleEnum.SUPER_ADMIN else {"payment_requests": ["read", "write"]},
                        is_system_role=True
                    )
                    db.add(r_obj)
                    await db.flush()
                roles[r_name.value] = r_obj

            # 3. Create Official MV Greentech Company
            company = Company(
                name="MV Greentech",
                code="MVG-01",
                address="Gurugram, Haryana, India",
                phone="+91-124-4567890",
                email="info@mvgreentech.com",
                gst_number="06AAAAA0000A1Z5",
                pan_number="AAAAA0000A",
                primary_color="#0D5C3A",
                is_active=True
            )
            db.add(company)
            await db.flush()

            # 4. Create Standard Departments
            departments = {}
            for dept_name, code in [
                ("Accounts & Finance", "FIN-01"),
                ("Operations", "OPS-01"),
                ("Procurement", "PROC-01"),
                ("Management", "MGMT-01"),
            ]:
                dept = Department(
                    company_id=company.id,
                    name=dept_name,
                    code=code,
                    is_active=True
                )
                db.add(dept)
                await db.flush()
                departments[code] = dept

            # 5. Create Official Corporate Accounts for the 4 Key Roles
            users_to_create = [
                {
                    "email": "admin@mvgreentech.com",
                    "password": "Admin@MVGreentech2026",
                    "first_name": "System",
                    "last_name": "Admin",
                    "role_name": RoleEnum.SUPER_ADMIN.value,
                    "dept_code": "MGMT-01",
                    "phone": "+91-9876543210"
                },
                {
                    "email": "approver@mvgreentech.com",
                    "password": "Approver@MVGreentech2026",
                    "first_name": "Executive",
                    "last_name": "Approver",
                    "role_name": RoleEnum.DIRECTOR.value,
                    "dept_code": "MGMT-01",
                    "phone": "+91-9876543211"
                },
                {
                    "email": "accountant@mvgreentech.com",
                    "password": "Accountant@MVGreentech2026",
                    "first_name": "Finance",
                    "last_name": "Accountant",
                    "role_name": RoleEnum.ACCOUNTANT.value,
                    "dept_code": "FIN-01",
                    "phone": "+91-9876543212"
                },
                {
                    "email": "requester@mvgreentech.com",
                    "password": "Requester@MVGreentech2026",
                    "first_name": "Operations",
                    "last_name": "Requester",
                    "role_name": RoleEnum.DEPARTMENT_HEAD.value,
                    "dept_code": "OPS-01",
                    "phone": "+91-9876543213"
                }
            ]

            for u_data in users_to_create:
                u = User(
                    company_id=company.id,
                    department_id=departments[u_data["dept_code"]].id,
                    role_id=roles[u_data["role_name"]].id,
                    email=u_data["email"],
                    password_hash=hash_password(u_data["password"]),
                    first_name=u_data["first_name"],
                    last_name=u_data["last_name"],
                    phone=u_data["phone"],
                    is_active=True,
                    email_verified=True,
                )
                db.add(u)

            await db.commit()

            return {
                "status": "success",
                "message": "System successfully configured with 4 core production roles.",
                "roles_configured": [
                    {"role": "Super Admin", "email": "admin@mvgreentech.com", "password": "Admin@MVGreentech2026"},
                    {"role": "Approver / Director", "email": "approver@mvgreentech.com", "password": "Approver@MVGreentech2026"},
                    {"role": "Accountant / Finance", "email": "accountant@mvgreentech.com", "password": "Accountant@MVGreentech2026"},
                    {"role": "Requester / Operations", "email": "requester@mvgreentech.com", "password": "Requester@MVGreentech2026"}
                ],
                "company": "MV Greentech",
                "demo_requests_deleted": True,
                "demo_vendors_deleted": True
            }
    except Exception as exc:
        logger.error("Production clean reset failed: %s", exc)
        return {"status": "error", "message": str(exc)}



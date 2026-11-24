import asyncio
import uuid
from app.database import AsyncSessionLocal
from app.models.role import Role, RoleEnum
from app.models.company import Company
from app.models.department import Department
from app.models.user import User
from app.utils.security import hash_password
from sqlalchemy import select

async def seed():
    async with AsyncSessionLocal() as db:
        # 1. Check if super admin already exists
        q = select(User).where(User.email == "admin@mvpayments.com")
        res = await db.execute(q)
        if res.scalar_one_or_none():
            print("Demo users already seeded!")
            return

        # 2. Ensure roles exist
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

        # 3. Create default company
        company = Company(
            name="MV Electrosystems / MV Greentech",
            code="MVE-01",
            address="Plot No. 45, Industrial Area, Sector 8, Gurugram, Haryana",
            phone="+91-124-4567890",
            email="finance@mvelectrosystems.com",
            gst_number="06AAAAA0000A1Z5",
            pan_number="AAAAA0000A",
            is_active=True
        )
        db.add(company)
        await db.flush()

        # 4. Create default department
        dept = Department(
            name="Finance & Accounts",
            code="FIN-01",
            company_id=company.id,
            is_active=True
        )
        db.add(dept)
        await db.flush()

        # 5. Create demo users
        demo_users = [
            {
                "email": "admin@mvpayments.com",
                "password": "Admin@12345",
                "first_name": "Rajesh",
                "last_name": "Sharma",
                "role_id": roles[RoleEnum.SUPER_ADMIN.value].id,
            },
            {
                "email": "approver@mvpayments.com",
                "password": "Approver@12345",
                "first_name": "Vikram",
                "last_name": "Malhotra",
                "role_id": roles[RoleEnum.DIRECTOR.value].id,
            },
            {
                "email": "accountant@mvpayments.com",
                "password": "Accountant@12345",
                "first_name": "Priya",
                "last_name": "Desai",
                "role_id": roles[RoleEnum.ACCOUNTANT.value].id,
            },
            {
                "email": "requester@mvpayments.com",
                "password": "Requester@12345",
                "first_name": "Amit",
                "last_name": "Patel",
                "role_id": roles[RoleEnum.DEPARTMENT_HEAD.value].id,
            }
        ]

        for u in demo_users:
            new_u = User(
                email=u["email"],
                password_hash=hash_password(u["password"]),
                first_name=u["first_name"],
                last_name=u["last_name"],
                role_id=u["role_id"],
                company_id=company.id,
                department_id=dept.id,
                is_active=True,
                is_locked=False,
                email_verified=True
            )
            db.add(new_u)

        await db.commit()
        print("Demo data seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed())

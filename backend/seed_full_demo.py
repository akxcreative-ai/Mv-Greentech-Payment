import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.role import Role, RoleEnum
from app.models.company import Company
from app.models.department import Department
from app.models.user import User
from app.models.vendor import Vendor
from app.models.payment_request import (
    PaymentRequest,
    PaymentStatus,
    ExpenseCategory,
    PaymentMode,
    PaymentPriority,
)
from app.models.approval import ApprovalRecord, ApprovalStatus, ClarificationMessage
from app.models.payment_record import PaymentRecord
from app.models.audit_log import AuditLog, AuditEventType
from app.models.settings import ApprovalRule, SystemSettings
from app.utils.security import hash_password

async def seed_full():
    async with AsyncSessionLocal() as db:
        print("Starting comprehensive demo data seeding...")

        # 1. Ensure Roles
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

        # 2. Company: MV Electrosystems / MV Greentech
        q_comp = select(Company).where(Company.code == "MVE-01")
        res_comp = await db.execute(q_comp)
        company = res_comp.scalar_one_or_none()
        if not company:
            company = Company(
                name="MV Electrosystems / MV Greentech",
                code="MVE-01",
                address="Plot No. 45, Industrial Area, Sector 8, Gurugram, Haryana - 122001",
                phone="+91-124-4567890",
                email="accounts@mvgreentech.com",
                gst_number="06AAAAA0000A1Z5",
                pan_number="AAAAA0000A",
                primary_color="#0B1220",
                secondary_color="#14B8A6",
                is_active=True
            )
            db.add(company)
            await db.flush()

        # 3. Department: Finance & Accounts
        q_dept = select(Department).where(Department.code == "FIN-01")
        res_dept = await db.execute(q_dept)
        dept = res_dept.scalar_one_or_none()
        if not dept:
            dept = Department(
                name="Finance & Accounts",
                code="FIN-01",
                company_id=company.id,
                is_active=True
            )
            db.add(dept)
            await db.flush()

        dept2 = await db.execute(select(Department).where(Department.code == "OPS-01"))
        dept_ops = dept2.scalar_one_or_none()
        if not dept_ops:
            dept_ops = Department(
                name="Operations & Plant",
                code="OPS-01",
                company_id=company.id,
                is_active=True
            )
            db.add(dept_ops)
            await db.flush()

        # 4. Users
        users_config = [
            ("admin@mvpayments.com", "Admin@12345", "Rajesh", "Sharma", roles[RoleEnum.SUPER_ADMIN.value].id, dept.id),
            ("approver@mvpayments.com", "Approver@12345", "Vikram", "Malhotra", roles[RoleEnum.DIRECTOR.value].id, dept.id),
            ("accountant@mvpayments.com", "Accountant@12345", "Priya", "Desai", roles[RoleEnum.ACCOUNTANT.value].id, dept.id),
            ("requester@mvpayments.com", "Requester@12345", "Amit", "Patel", roles[RoleEnum.DEPARTMENT_HEAD.value].id, dept_ops.id),
        ]

        users = {}
        for email, pwd, first, last, role_id, d_id in users_config:
            q_u = select(User).where(User.email == email)
            res_u = await db.execute(q_u)
            user_obj = res_u.scalar_one_or_none()
            if not user_obj:
                user_obj = User(
                    email=email,
                    password_hash=hash_password(pwd),
                    first_name=first,
                    last_name=last,
                    role_id=role_id,
                    company_id=company.id,
                    department_id=d_id,
                    is_active=True,
                    is_locked=False,
                    email_verified=True
                )
                db.add(user_obj)
                await db.flush()
            users[email] = user_obj

        admin = users["admin@mvpayments.com"]
        approver = users["approver@mvpayments.com"]
        accountant = users["accountant@mvpayments.com"]
        requester = users["requester@mvpayments.com"]

        # 5. Vendors
        vendors_data = [
            ("Schneider Electric India Pvt Ltd", "VND-SE-001", "Ramesh Verma", "ramesh@schneider-india.com", "+91-9811223344", "HDFC0001234", "50200012345678", "HDFC Bank, Gurugram"),
            ("Tata Steel Industrial Components", "VND-TS-002", "Anand Kulkarni", "anand@tatasteel.com", "+91-9822334455", "ICIC0000456", "002305012345", "ICICI Bank, Connaught Place"),
            ("Om Logistics Supply Chain", "VND-OM-003", "Suresh Gupta", "billing@omlogistics.co.in", "+91-9833445566", "SBIN0001890", "31234567890", "SBI Industrial Branch, Manesar"),
            ("Adani Electricity & Power Solutions", "VND-AD-004", "Deepak Rao", "ebill@adani.com", "+91-9844556677", "KKBK0000123", "123456789012", "Kotak Mahindra Bank, Delhi"),
            ("Deloitte Touche Tohmatsu India", "VND-DL-005", "Meera Sen", "meera.sen@deloitte.com", "+91-9855667788", "CITI0000002", "0123456789", "Citi Bank, Cyber City"),
        ]

        vendors = []
        for name, code, contact, email, phone, ifsc, acc_no, branch in vendors_data:
            q_v = select(Vendor).where(Vendor.code == code)
            res_v = await db.execute(q_v)
            v_obj = res_v.scalar_one_or_none()
            if not v_obj:
                v_obj = Vendor(
                    name=name,
                    code=code,
                    company_id=company.id,
                    contact_person=contact,
                    email=email,
                    phone=phone,
                    address="Industrial Hub, Haryana",
                    gst_number="06ABCDE1234F1Z5",
                    pan_number="ABCDE1234F",
                    bank_name=branch.split(",")[0],
                    bank_account_number=acc_no,
                    bank_ifsc=ifsc,
                    bank_branch=branch,
                    is_active=True
                )
                db.add(v_obj)
                await db.flush()
            vendors.append(v_obj)

        # 6. Approval Rules
        q_rule = select(ApprovalRule).where(ApprovalRule.company_id == company.id)
        rule_res = await db.execute(q_rule)
        if not rule_res.scalar_one_or_none():
            rule = ApprovalRule(
                company_id=company.id,
                min_amount=Decimal("1000.00"),
                max_amount=Decimal("100000000.00"),
                requires_approval=True,
                approver_role="director",
                is_active=True
            )
            db.add(rule)
            await db.flush()

        # 7. Payment Requests
        now = datetime.now(timezone.utc)
        requests_data = [
            {
                "num": "PR-2026-0001",
                "vendor": vendors[0],
                "cat": ExpenseCategory.RAW_MATERIAL,
                "purpose": "HT Switchgear & Cable Terminal Kits for Project Sector-62",
                "inv_num": "SE-INV-8941",
                "amount": Decimal("145000.00"),
                "gst": Decimal("26100.00"),
                "total": Decimal("171100.00"),
                "status": PaymentStatus.PENDING_APPROVAL,
                "priority": PaymentPriority.HIGH,
                "mode": PaymentMode.RTGS,
            },
            {
                "num": "PR-2026-0002",
                "vendor": vendors[1],
                "cat": ExpenseCategory.PURCHASE,
                "purpose": "Galvanized Steel Channels for Plant Mounting Structure",
                "inv_num": "TS-IND-4421",
                "amount": Decimal("85000.00"),
                "gst": Decimal("15300.00"),
                "total": Decimal("100300.00"),
                "status": PaymentStatus.PENDING_APPROVAL,
                "priority": PaymentPriority.URGENT,
                "mode": PaymentMode.NEFT,
            },
            {
                "num": "PR-2026-0003",
                "vendor": vendors[2],
                "cat": ExpenseCategory.TRANSPORT,
                "purpose": "Freight & Inbound Raw Material Container Transport",
                "inv_num": "OM-DEL-1029",
                "amount": Decimal("34000.00"),
                "gst": Decimal("6120.00"),
                "total": Decimal("40120.00"),
                "status": PaymentStatus.APPROVED,
                "priority": PaymentPriority.NORMAL,
                "mode": PaymentMode.NEFT,
            },
            {
                "num": "PR-2026-0004",
                "vendor": vendors[3],
                "cat": ExpenseCategory.UTILITY_BILLS,
                "purpose": "Industrial Power Supply Billing - Manufacturing Unit 2",
                "inv_num": "EB-FEB-2026",
                "amount": Decimal("52400.00"),
                "gst": Decimal("9432.00"),
                "total": Decimal("61832.00"),
                "status": PaymentStatus.PAID,
                "priority": PaymentPriority.NORMAL,
                "mode": PaymentMode.RTGS,
            },
            {
                "num": "PR-2026-0005",
                "vendor": vendors[4],
                "cat": ExpenseCategory.PROFESSIONAL_FEES,
                "purpose": "Statutory Quarterly Audit & Tax Compliance Retainer",
                "inv_num": "DEL-RET-098",
                "amount": Decimal("65000.00"),
                "gst": Decimal("11700.00"),
                "total": Decimal("76700.00"),
                "status": PaymentStatus.CLARIFICATION_REQUIRED,
                "priority": PaymentPriority.LOW,
                "mode": PaymentMode.NEFT,
            },
        ]

        for r in requests_data:
            q_pr = select(PaymentRequest).where(PaymentRequest.request_number == r["num"])
            pr_res = await db.execute(q_pr)
            if not pr_res.scalar_one_or_none():
                pr = PaymentRequest(
                    request_number=r["num"],
                    company_id=company.id,
                    department_id=dept.id,
                    requested_by_id=accountant.id,
                    vendor_id=r["vendor"].id,
                    expense_category=r["cat"],
                    expense_subcategory="Industrial Procurement",
                    payment_purpose=r["purpose"],
                    invoice_number=r["inv_num"],
                    invoice_date=now - timedelta(days=5),
                    due_date=now + timedelta(days=7),
                    amount=r["amount"],
                    gst_amount=r["gst"],
                    total_amount=r["total"],
                    payment_mode=r["mode"],
                    bank_account="HDFC Current A/c ***5678",
                    priority=r["priority"],
                    remarks="Verified with PO and Delivery Challan.",
                    status=r["status"],
                    assigned_approver_id=approver.id,
                    submitted_at=now - timedelta(days=2),
                    approved_at=now - timedelta(days=1) if r["status"] in [PaymentStatus.APPROVED, PaymentStatus.PAID, PaymentStatus.COMPLETED] else None,
                    paid_at=now - timedelta(hours=6) if r["status"] in [PaymentStatus.PAID, PaymentStatus.COMPLETED] else None,
                )
                db.add(pr)
                await db.flush()

                # Add Approval Record if Approved or Paid
                if r["status"] in [PaymentStatus.APPROVED, PaymentStatus.PAID]:
                    appr_rec = ApprovalRecord(
                        payment_request_id=pr.id,
                        approver_id=approver.id,
                        status=ApprovalStatus.APPROVED,
                        comment="Approved for payment execution per procurement contract.",
                        original_amount=pr.total_amount,
                        approved_amount=pr.total_amount,
                        ip_address="192.168.1.14",
                        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    )
                    db.add(appr_rec)

                # Add Payment Record if Paid
                if r["status"] == PaymentStatus.PAID:
                    pay_rec = PaymentRecord(
                        payment_request_id=pr.id,
                        paid_by_id=accountant.id,
                        payment_date=now - timedelta(hours=6),
                        actual_amount=pr.total_amount,
                        payment_mode=r["mode"].value,
                        bank_account="HDFC Current A/c ***5678",
                        transaction_id="TXN9876543210",
                        utr_number="HDFCR520260224009182",
                        payment_reference="NEFT/HDFC/MVE/EB-FEB",
                        payment_remarks="Payment processed via NetBanking portal. UTR shared with vendor.",
                    )
                    db.add(pay_rec)

                # Add Clarification Message if clarification required
                if r["status"] == PaymentStatus.CLARIFICATION_REQUIRED:
                    clar = ClarificationMessage(
                        payment_request_id=pr.id,
                        sender_id=approver.id,
                        message="Please confirm whether the TDS deduction certificate is attached with this billing.",
                        is_response=False,
                    )
                    db.add(clar)

        await db.commit()
        print("Comprehensive demo data successfully seeded!")

if __name__ == "__main__":
    asyncio.run(seed_full())

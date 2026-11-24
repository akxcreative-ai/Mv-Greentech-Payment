"""
Reporting & Business Intelligence Dashboard API Router.

Implements dashboard KPIs, executive analytics, and exportable financial reports:
- GET /api/reports/dashboard/admin - Macro-level stats across companies, volume, status breakdown
- GET /api/reports/dashboard/approver - Assigned queues, turnaround metrics, and decisions
- GET /api/reports/dashboard/accountant - Payout pipeline, disbursements, and banking modes
- GET /api/reports/{type} - Tabular report generator (by category, vendor, department, monthly)
- GET /api/reports/{type}/export - Formatted report exports (CSV, Excel XLSX, PDF)
"""

import csv
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import io
import logging
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import case, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.models.approval import ApprovalRecord, ApprovalStatus
from app.models.company import Company
from app.models.department import Department
from app.models.payment_record import PaymentRecord
from app.models.payment_request import (
    ExpenseCategory,
    PaymentMode,
    PaymentPriority,
    PaymentRequest,
    PaymentStatus,
)
from app.models.role import RoleEnum
from app.models.user import User
from app.models.vendor import Vendor

logger = logging.getLogger("mv-payment-approval.api.reports")

router = APIRouter(prefix="/reports", tags=["Reports"])


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class AdminDashboardStats(BaseModel):
    total_requests: int
    total_amount: Decimal
    pending_approval_count: int
    pending_approval_amount: Decimal
    approved_count: int
    approved_amount: Decimal
    paid_count: int
    paid_amount: Decimal
    rejected_count: int
    clarification_count: int
    status_breakdown: Dict[str, int]
    top_departments: List[Dict[str, Any]]
    top_categories: List[Dict[str, Any]]


class ApproverDashboardStats(BaseModel):
    assigned_pending_count: int
    assigned_pending_amount: Decimal
    urgent_count: int
    approved_this_month: int
    approved_amount_this_month: Decimal
    rejected_this_month: int
    clarifications_requested_count: int


class AccountantDashboardStats(BaseModel):
    ready_for_payment_count: int
    ready_for_payment_amount: Decimal
    paid_this_month_count: int
    paid_this_month_amount: Decimal
    payment_modes_breakdown: Dict[str, int]
    recent_disbursements: List[Dict[str, Any]]


class RequesterDashboardStats(BaseModel):
    total_requests: int
    total_amount: Decimal
    draft_count: int
    pending_approval_count: int
    pending_approval_amount: Decimal
    approved_count: int
    approved_amount: Decimal
    paid_count: int
    paid_amount: Decimal
    rejected_count: int
    clarification_count: int


class RoleDashboardStatsResponse(BaseModel):
    role: str
    stats: Dict[str, Any]


class ReportDataResponse(BaseModel):
    report_type: str
    generated_at: datetime
    total_records: int
    total_sum: Decimal
    rows: List[Dict[str, Any]]


# --------------------------------------------------------------------------
# Dashboard Endpoints
# --------------------------------------------------------------------------

@router.get(
    "/dashboard/admin",
    response_model=AdminDashboardStats,
    status_code=status.HTTP_200_OK,
    summary="Admin Executive Dashboard Stats",
    description="Macro-level metrics on organization spend, pipeline status, and departmental breakdowns.",
    dependencies=[Depends(require_role(RoleEnum.SUPER_ADMIN, RoleEnum.DIRECTOR))],
)
async def get_admin_dashboard(
    company_id: Optional[uuid.UUID] = Query(None, description="Optional company filter"),
    db: AsyncSession = Depends(get_db),
):
    base_q = select(PaymentRequest).where(PaymentRequest.is_deleted == False)
    if company_id:
        base_q = base_q.where(PaymentRequest.company_id == company_id)

    # Status counts and totals
    agg_q = (
        select(
            PaymentRequest.status,
            func.count(PaymentRequest.id).label("count"),
            func.coalesce(func.sum(PaymentRequest.total_amount), 0).label("sum_amount"),
        )
        .where(PaymentRequest.is_deleted == False)
    )
    if company_id:
        agg_q = agg_q.where(PaymentRequest.company_id == company_id)
    agg_q = agg_q.group_by(PaymentRequest.status)

    agg_res = await db.execute(agg_q)
    status_data = agg_res.all()

    status_breakdown = {}
    pending_cnt, pending_amt = 0, Decimal("0.00")
    approved_cnt, approved_amt = 0, Decimal("0.00")
    paid_cnt, paid_amt = 0, Decimal("0.00")
    rejected_cnt = 0
    clarification_cnt = 0
    total_cnt = 0
    total_amt = Decimal("0.00")

    for row in status_data:
        st, count, amt = row.status.value, row.count, Decimal(str(row.sum_amount))
        status_breakdown[st] = count
        total_cnt += count
        total_amt += amt

        if st == PaymentStatus.PENDING_APPROVAL.value:
            pending_cnt = count
            pending_amt = amt
        elif st == PaymentStatus.APPROVED.value:
            approved_cnt = count
            approved_amt = amt
        elif st in (PaymentStatus.PAID.value, PaymentStatus.COMPLETED.value):
            paid_cnt += count
            paid_amt += amt
        elif st == PaymentStatus.REJECTED.value:
            rejected_cnt = count
        elif st == PaymentStatus.CLARIFICATION_REQUIRED.value:
            clarification_cnt = count

    # Top departments by spend
    dept_q = (
        select(
            Department.name,
            func.sum(PaymentRequest.total_amount).label("dept_sum"),
            func.count(PaymentRequest.id).label("dept_count"),
        )
        .join(PaymentRequest, PaymentRequest.department_id == Department.id)
        .where(
            PaymentRequest.is_deleted == False,
            PaymentRequest.status.in_([PaymentStatus.APPROVED, PaymentStatus.PAID, PaymentStatus.COMPLETED]),
        )
    )
    if company_id:
        dept_q = dept_q.where(PaymentRequest.company_id == company_id)
    dept_q = dept_q.group_by(Department.name).order_by(desc("dept_sum")).limit(5)
    dept_res = await db.execute(dept_q)
    top_depts = [
        {"department": r[0], "total_spend": float(r[1] or 0), "count": r[2]}
        for r in dept_res.all()
    ]

    # Top expense categories
    cat_q = (
        select(
            PaymentRequest.expense_category,
            func.sum(PaymentRequest.total_amount).label("cat_sum"),
            func.count(PaymentRequest.id).label("cat_count"),
        )
        .where(
            PaymentRequest.is_deleted == False,
            PaymentRequest.status.in_([PaymentStatus.APPROVED, PaymentStatus.PAID, PaymentStatus.COMPLETED]),
        )
    )
    if company_id:
        cat_q = cat_q.where(PaymentRequest.company_id == company_id)
    cat_q = cat_q.group_by(PaymentRequest.expense_category).order_by(desc("cat_sum")).limit(5)
    cat_res = await db.execute(cat_q)
    top_cats = [
        {"category": r[0].value, "total_spend": float(r[1] or 0), "count": r[2]}
        for r in cat_res.all()
    ]

    return AdminDashboardStats(
        total_requests=total_cnt,
        total_amount=total_amt,
        pending_approval_count=pending_cnt,
        pending_approval_amount=pending_amt,
        approved_count=approved_cnt,
        approved_amount=approved_amt,
        paid_count=paid_cnt,
        paid_amount=paid_amt,
        rejected_count=rejected_cnt,
        clarification_count=clarification_cnt,
        status_breakdown=status_breakdown,
        top_departments=top_depts,
        top_categories=top_cats,
    )


@router.get(
    "/dashboard/approver",
    response_model=ApproverDashboardStats,
    status_code=status.HTTP_200_OK,
    summary="Approver Dashboard Stats",
    description="Metrics specific to the current reviewer's pending workload and monthly decision pace.",
)
async def get_approver_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Pending approvals assigned
    pend_q = select(
        func.count(PaymentRequest.id),
        func.coalesce(func.sum(PaymentRequest.total_amount), 0),
    ).where(
        PaymentRequest.assigned_approver_id == current_user.id,
        PaymentRequest.status == PaymentStatus.PENDING_APPROVAL,
        PaymentRequest.is_deleted == False,
    )
    pend_res = await db.execute(pend_q)
    pend_row = pend_res.one()
    pending_cnt = pend_row[0]
    pending_amt = Decimal(str(pend_row[1]))

    # Urgent requests pending
    urg_q = select(func.count(PaymentRequest.id)).where(
        PaymentRequest.assigned_approver_id == current_user.id,
        PaymentRequest.status == PaymentStatus.PENDING_APPROVAL,
        PaymentRequest.priority == PaymentPriority.URGENT,
        PaymentRequest.is_deleted == False,
    )
    urg_res = await db.execute(urg_q)
    urgent_cnt = urg_res.scalar_one()

    # Approvals completed this month by current user
    start_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_app_q = select(
        func.count(ApprovalRecord.id),
        func.coalesce(func.sum(ApprovalRecord.approved_amount), 0),
    ).where(
        ApprovalRecord.approver_id == current_user.id,
        ApprovalRecord.status == ApprovalStatus.APPROVED,
        ApprovalRecord.created_at >= start_of_month,
    )
    month_res = await db.execute(month_app_q)
    m_row = month_res.one()
    app_month_cnt = m_row[0]
    app_month_amt = Decimal(str(m_row[1]))

    # Rejections this month
    rej_q = select(func.count(ApprovalRecord.id)).where(
        ApprovalRecord.approver_id == current_user.id,
        ApprovalRecord.status == ApprovalStatus.REJECTED,
        ApprovalRecord.created_at >= start_of_month,
    )
    rej_res = await db.execute(rej_q)
    rej_month_cnt = rej_res.scalar_one()

    # Clarifications requested
    clar_q = select(func.count(ApprovalRecord.id)).where(
        ApprovalRecord.approver_id == current_user.id,
        ApprovalRecord.status == ApprovalStatus.CLARIFICATION_REQUIRED,
        ApprovalRecord.created_at >= start_of_month,
    )
    clar_res = await db.execute(clar_q)
    clar_cnt = clar_res.scalar_one()

    return ApproverDashboardStats(
        assigned_pending_count=pending_cnt,
        assigned_pending_amount=pending_amt,
        urgent_count=urgent_cnt,
        approved_this_month=app_month_cnt,
        approved_amount_this_month=app_month_amt,
        rejected_this_month=rej_month_cnt,
        clarifications_requested_count=clar_cnt,
    )


@router.get(
    "/dashboard/accountant",
    response_model=AccountantDashboardStats,
    status_code=status.HTTP_200_OK,
    summary="Accountant Payout Dashboard Stats",
    description="Disbursement pipeline tracking approved requests ready for execution and banking mode distributions.",
    dependencies=[Depends(require_role(RoleEnum.SUPER_ADMIN, RoleEnum.ACCOUNTANT))],
)
async def get_accountant_dashboard(
    company_id: Optional[uuid.UUID] = Query(None, description="Optional company filter"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target_company = company_id or current_user.company_id

    # Approved requests ready for payment execution
    ready_q = select(
        func.count(PaymentRequest.id),
        func.coalesce(func.sum(PaymentRequest.total_amount), 0),
    ).where(
        PaymentRequest.status == PaymentStatus.APPROVED,
        PaymentRequest.is_deleted == False,
    )
    if target_company:
        ready_q = ready_q.where(PaymentRequest.company_id == target_company)
    ready_res = await db.execute(ready_q)
    r_row = ready_res.one()
    ready_cnt = r_row[0]
    ready_amt = Decimal(str(r_row[1]))

    # Paid this month
    start_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    paid_q = select(
        func.count(PaymentRecord.id),
        func.coalesce(func.sum(PaymentRecord.actual_amount), 0),
    ).where(PaymentRecord.payment_date >= start_of_month)
    paid_res = await db.execute(paid_q)
    p_row = paid_res.one()
    paid_cnt = p_row[0]
    paid_amt = Decimal(str(p_row[1]))

    # Payment modes breakdown
    mode_q = (
        select(PaymentRecord.payment_mode, func.count(PaymentRecord.id))
        .where(PaymentRecord.payment_date >= start_of_month)
        .group_by(PaymentRecord.payment_mode)
    )
    mode_res = await db.execute(mode_q)
    modes_breakdown = {r[0].value: r[1] for r in mode_res.all()}

    # Recent 5 disbursements
    recent_q = (
        select(PaymentRecord, PaymentRequest)
        .join(PaymentRequest, PaymentRecord.payment_request_id == PaymentRequest.id)
        .order_by(desc(PaymentRecord.payment_date))
        .limit(5)
    )
    recent_res = await db.execute(recent_q)
    recent_list = []
    for prec, preq in recent_res.all():
        recent_list.append({
            "request_number": preq.request_number,
            "actual_amount": float(prec.actual_amount),
            "payment_mode": prec.payment_mode.value,
            "utr_number": prec.utr_number,
            "payment_date": prec.payment_date.isoformat(),
        })

    return AccountantDashboardStats(
        ready_for_payment_count=ready_cnt,
        ready_for_payment_amount=ready_amt,
        paid_this_month_count=paid_cnt,
        paid_this_month_amount=paid_amt,
        payment_modes_breakdown=modes_breakdown,
        recent_disbursements=recent_list,
    )


async def get_requester_dashboard(
    current_user: User,
    db: AsyncSession,
) -> RequesterDashboardStats:
    """Calculates request status aggregates for regular requester users."""
    base_q = select(
        PaymentRequest.status,
        func.count(PaymentRequest.id),
        func.coalesce(func.sum(PaymentRequest.total_amount), 0),
    ).where(
        PaymentRequest.requester_id == current_user.id,
        PaymentRequest.is_deleted == False,
    ).group_by(PaymentRequest.status)

    res = await db.execute(base_q)
    counts = {}
    amounts = {}
    for st, cnt, amt in res.all():
        counts[st] = cnt
        amounts[st] = Decimal(str(amt))

    total_cnt = sum(counts.values())
    total_amt = sum(amounts.values(), Decimal("0.00"))

    return RequesterDashboardStats(
        total_requests=total_cnt,
        total_amount=total_amt,
        draft_count=counts.get(PaymentStatus.DRAFT, 0),
        pending_approval_count=counts.get(PaymentStatus.PENDING_APPROVAL, 0),
        pending_approval_amount=amounts.get(PaymentStatus.PENDING_APPROVAL, Decimal("0.00")),
        approved_count=counts.get(PaymentStatus.APPROVED, 0),
        approved_amount=amounts.get(PaymentStatus.APPROVED, Decimal("0.00")),
        paid_count=counts.get(PaymentStatus.PAID, 0) + counts.get(PaymentStatus.COMPLETED, 0),
        paid_amount=amounts.get(PaymentStatus.PAID, Decimal("0.00")) + amounts.get(PaymentStatus.COMPLETED, Decimal("0.00")),
        rejected_count=counts.get(PaymentStatus.REJECTED, 0),
        clarification_count=counts.get(PaymentStatus.CLARIFICATION_REQUESTED, 0),
    )


@router.get(
    "/dashboard/stats",
    response_model=RoleDashboardStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Role-based Dashboard Stats",
    description="Automatically dispatches and returns tailored dashboard metrics according to the authenticated user's assigned role.",
)
@router.get(
    "/dashboard",
    response_model=RoleDashboardStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Role-based Dashboard Stats (Alias)",
    description="Alias for /dashboard/stats returning role-specific statistics.",
    include_in_schema=False,
)
async def get_dashboard_stats(
    company_id: Optional[uuid.UUID] = Query(None, description="Optional company filter"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role_name = current_user.role.name if current_user.role else ""

    if role_name in (RoleEnum.SUPER_ADMIN.value, RoleEnum.DIRECTOR.value):
        stats_obj = await get_admin_dashboard(company_id=company_id, db=db)
        return RoleDashboardStatsResponse(role=role_name, stats=stats_obj.model_dump())

    elif role_name == RoleEnum.ACCOUNTANT.value:
        stats_obj = await get_accountant_dashboard(company_id=company_id, current_user=current_user, db=db)
        return RoleDashboardStatsResponse(role=role_name, stats=stats_obj.model_dump())

    elif role_name in (RoleEnum.DEPARTMENT_HEAD.value, "approver", "hod", "finance_controller"):
        stats_obj = await get_approver_dashboard(current_user=current_user, db=db)
        return RoleDashboardStatsResponse(role=role_name, stats=stats_obj.model_dump())

    else:
        stats_obj = await get_requester_dashboard(current_user=current_user, db=db)
        return RoleDashboardStatsResponse(role=role_name, stats=stats_obj.model_dump())


# --------------------------------------------------------------------------
# Generic Reports & Exports
# --------------------------------------------------------------------------

async def fetch_report_data(
    report_type: str,
    company_id: Optional[uuid.UUID],
    department_id: Optional[uuid.UUID],
    start_date: Optional[datetime],
    end_date: Optional[datetime],
    db: AsyncSession,
) -> List[Dict[str, Any]]:
    """Generates structured dictionary rows according to report type."""
    type_norm = report_type.lower().strip()

    if type_norm == "expenses-by-category":
        q = (
            select(
                PaymentRequest.expense_category,
                func.count(PaymentRequest.id).label("request_count"),
                func.sum(PaymentRequest.amount).label("base_amount"),
                func.sum(PaymentRequest.gst_amount).label("gst_amount"),
                func.sum(PaymentRequest.total_amount).label("total_amount"),
            )
            .where(
                PaymentRequest.is_deleted == False,
                PaymentRequest.status.in_([PaymentStatus.APPROVED, PaymentStatus.PAID, PaymentStatus.COMPLETED]),
            )
        )
        if company_id:
            q = q.where(PaymentRequest.company_id == company_id)
        if department_id:
            q = q.where(PaymentRequest.department_id == department_id)
        if start_date:
            q = q.where(PaymentRequest.created_at >= start_date)
        if end_date:
            q = q.where(PaymentRequest.created_at <= end_date)
        q = q.group_by(PaymentRequest.expense_category).order_by(desc("total_amount"))
        res = await db.execute(q)
        return [
            {
                "Category": r[0].value,
                "Requests": r[1],
                "Base Amount": float(r[2] or 0),
                "GST Amount": float(r[3] or 0),
                "Total Amount": float(r[4] or 0),
            }
            for r in res.all()
        ]

    elif type_norm == "expenses-by-vendor":
        q = (
            select(
                Vendor.name.label("vendor_name"),
                Vendor.code.label("vendor_code"),
                func.count(PaymentRequest.id).label("request_count"),
                func.sum(PaymentRequest.total_amount).label("total_amount"),
            )
            .join(Vendor, PaymentRequest.vendor_id == Vendor.id)
            .where(
                PaymentRequest.is_deleted == False,
                PaymentRequest.status.in_([PaymentStatus.APPROVED, PaymentStatus.PAID, PaymentStatus.COMPLETED]),
            )
        )
        if company_id:
            q = q.where(PaymentRequest.company_id == company_id)
        if start_date:
            q = q.where(PaymentRequest.created_at >= start_date)
        if end_date:
            q = q.where(PaymentRequest.created_at <= end_date)
        q = q.group_by(Vendor.name, Vendor.code).order_by(desc("total_amount"))
        res = await db.execute(q)
        return [
            {
                "Vendor Name": r[0],
                "Vendor Code": r[1],
                "Invoices Count": r[2],
                "Total Disbursed": float(r[3] or 0),
            }
            for r in res.all()
        ]

    elif type_norm == "expenses-by-department":
        q = (
            select(
                Department.name.label("dept_name"),
                Department.code.label("dept_code"),
                func.count(PaymentRequest.id).label("request_count"),
                func.sum(PaymentRequest.total_amount).label("total_amount"),
            )
            .join(Department, PaymentRequest.department_id == Department.id)
            .where(
                PaymentRequest.is_deleted == False,
                PaymentRequest.status.in_([PaymentStatus.APPROVED, PaymentStatus.PAID, PaymentStatus.COMPLETED]),
            )
        )
        if company_id:
            q = q.where(PaymentRequest.company_id == company_id)
        if start_date:
            q = q.where(PaymentRequest.created_at >= start_date)
        if end_date:
            q = q.where(PaymentRequest.created_at <= end_date)
        q = q.group_by(Department.name, Department.code).order_by(desc("total_amount"))
        res = await db.execute(q)
        return [
            {
                "Department": r[0],
                "Code": r[1],
                "Requests": r[2],
                "Total Amount": float(r[3] or 0),
            }
            for r in res.all()
        ]

    else:
        # Default detailed requests report
        q = (
            select(PaymentRequest)
            .where(PaymentRequest.is_deleted == False)
        )
        if company_id:
            q = q.where(PaymentRequest.company_id == company_id)
        if department_id:
            q = q.where(PaymentRequest.department_id == department_id)
        if start_date:
            q = q.where(PaymentRequest.created_at >= start_date)
        if end_date:
            q = q.where(PaymentRequest.created_at <= end_date)
        q = q.order_by(desc(PaymentRequest.created_at)).limit(500)
        res = await db.execute(q)
        items = res.scalars().all()
        return [
            {
                "Request Number": p.request_number,
                "Category": p.expense_category.value,
                "Purpose": p.payment_purpose[:50],
                "Invoice Number": p.invoice_number or "",
                "Amount": float(p.amount),
                "GST Amount": float(p.gst_amount),
                "Total Amount": float(p.total_amount),
                "Status": p.status.value,
                "Created At": p.created_at.strftime("%Y-%m-%d %H:%M"),
            }
            for p in items
        ]


@router.get(
    "/{type}",
    response_model=ReportDataResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Financial Report",
    description="Generates tabular report records (expenses-by-category, expenses-by-vendor, expenses-by-department, default).",
)
async def generate_report(
    type: str,
    company_id: Optional[uuid.UUID] = Query(None),
    department_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    rows = await fetch_report_data(type, company_id, department_id, start_date, end_date, db)
    total_records = len(rows)
    total_sum = Decimal(str(sum(
        r.get("Total Amount") or r.get("Total Disbursed") or 0.0 for r in rows
    )))

    return ReportDataResponse(
        report_type=type,
        generated_at=datetime.now(timezone.utc),
        total_records=total_records,
        total_sum=total_sum,
        rows=rows,
    )


@router.get(
    "/{type}/export",
    summary="Export Financial Report",
    description="Exports formatted reports as CSV, Excel (xlsx), or PDF.",
)
async def export_report(
    type: str,
    format: str = Query("csv", pattern="^(csv|xlsx|pdf)$", description="Export format"),
    company_id: Optional[uuid.UUID] = Query(None),
    department_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    rows = await fetch_report_data(type, company_id, department_id, start_date, end_date, db)
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"report_{type}_{timestamp_str}"

    if not rows:
        rows = [{"Message": "No data available for the selected criteria."}]

    headers = list(rows[0].keys())

    # 1. CSV Export
    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)
        csv_data = output.getvalue()
        output.close()

        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
        )

    # 2. Excel (XLSX) Export using openpyxl
    elif format == "xlsx":
        try:
            import openpyxl
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = type[:30]
            ws.append(headers)
            for r in rows:
                ws.append([r.get(h, "") for h in headers])

            bio = io.BytesIO()
            wb.save(bio)
            bio.seek(0)
            excel_bytes = bio.getvalue()

            return Response(
                content=excel_bytes,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'},
            )
        except Exception as exc:
            logger.error("XLSX export failed: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate Excel export: {exc}",
            )

    # 3. PDF Export using reportlab
    elif format == "pdf":
        try:
            from reportlab.lib.pagesizes import letter, landscape
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.lib import colors

            bio = io.BytesIO()
            doc = SimpleDocTemplate(bio, pagesize=landscape(letter))
            elements = []
            styles = getSampleStyleSheet()

            elements.append(Paragraph(f"<b>Financial Report: {type.upper()}</b>", styles["Title"]))
            elements.append(Spacer(1, 12))

            table_data = [headers]
            for r in rows:
                table_data.append([str(r.get(h, "")) for h in headers])

            t = Table(table_data)
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E40AF")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elements.append(t)
            doc.build(elements)
            bio.seek(0)
            pdf_bytes = bio.getvalue()

            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
            )
        except Exception as exc:
            logger.error("PDF export failed: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate PDF export: {exc}",
            )

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported format.")

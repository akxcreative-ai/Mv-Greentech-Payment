"""
Report Service for MV Payment Approval System.
Provides analytics dashboards, 12 comprehensive operational/financial reports,
and export capabilities to Excel and CSV formats.
"""

import csv
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
import io
import re
from typing import Any, Dict, List, Optional, Tuple, Union
import uuid

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from fastapi import HTTPException, status
from sqlalchemy import and_, case, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
from app.models.user import User
from app.models.vendor import Vendor


def _parse_date(date_val: Any) -> Optional[datetime]:
    """Helper to parse datetime, date, or ISO string to timezone-aware UTC datetime."""
    if not date_val:
        return None
    if isinstance(date_val, datetime):
        if date_val.tzinfo is None:
            return date_val.replace(tzinfo=timezone.utc)
        return date_val.astimezone(timezone.utc)
    if isinstance(date_val, date):
        return datetime.combine(date_val, time.min, tzinfo=timezone.utc)
    if isinstance(date_val, str):
        try:
            dt = datetime.fromisoformat(date_val.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            try:
                d = datetime.strptime(date_val, "%Y-%m-%d")
                return datetime.combine(d.date(), time.min, tzinfo=timezone.utc)
            except ValueError:
                return None
    return None


def _format_cell_value(val: Any) -> Any:
    """Format a Python value for clean tabular output."""
    if val is None:
        return "-"
    if isinstance(val, (datetime, date)):
        return val.strftime("%Y-%m-%d %H:%M") if isinstance(val, datetime) else val.strftime("%Y-%m-%d")
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, bool):
        return "Yes" if val else "No"
    if isinstance(val, uuid.UUID):
        return str(val)
    if hasattr(val, "value"):
        return val.value
    return str(val)


# ==============================================================================
# DASHBOARD SERVICES
# ==============================================================================

async def get_admin_dashboard(db: AsyncSession) -> Dict[str, Any]:
    """
    Generate executive dashboard statistics across all companies, departments,
    and payment request states.
    """
    now = datetime.now(timezone.utc)
    today_start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
    month_start = datetime.combine(now.date().replace(day=1), time.min, tzinfo=timezone.utc)

    # 1. Total count & total amount
    total_q = select(
        func.count(PaymentRequest.id).label("total_count"),
        func.coalesce(func.sum(PaymentRequest.total_amount), 0).label("total_amount"),
    )
    total_res = (await db.execute(total_q)).one()
    total_count = total_res.total_count or 0
    total_amount = float(total_res.total_amount or 0)

    # 2. Status Breakdown
    status_q = select(
        PaymentRequest.status,
        func.count(PaymentRequest.id).label("count"),
        func.coalesce(func.sum(PaymentRequest.total_amount), 0).label("amount"),
    ).group_by(PaymentRequest.status)
    status_rows = (await db.execute(status_q)).all()

    status_breakdown = {}
    for row in status_rows:
        status_key = row.status.value if hasattr(row.status, "value") else str(row.status)
        status_breakdown[status_key] = {
            "count": row.count,
            "amount": float(row.amount),
        }

    # Helper getters for common statuses
    pending_info = status_breakdown.get(PaymentStatus.PENDING_APPROVAL.value, {"count": 0, "amount": 0.0})
    approved_info = status_breakdown.get(PaymentStatus.APPROVED.value, {"count": 0, "amount": 0.0})
    paid_info = status_breakdown.get(PaymentStatus.PAID.value, {"count": 0, "amount": 0.0})
    completed_info = status_breakdown.get(PaymentStatus.COMPLETED.value, {"count": 0, "amount": 0.0})
    rejected_info = status_breakdown.get(PaymentStatus.REJECTED.value, {"count": 0, "amount": 0.0})

    # 3. Monthly Spend (last 6 months)
    six_months_ago = today_start - timedelta(days=180)
    monthly_q = select(
        PaymentRequest.created_at,
        PaymentRequest.total_amount,
        PaymentRequest.status,
    ).where(PaymentRequest.created_at >= six_months_ago)
    monthly_rows = (await db.execute(monthly_q)).all()

    monthly_stats: Dict[str, Dict[str, Any]] = {}
    for row in monthly_rows:
        m_key = row.created_at.strftime("%Y-%m")
        if m_key not in monthly_stats:
            monthly_stats[m_key] = {"month": m_key, "total_requests": 0, "total_amount": 0.0, "paid_amount": 0.0}
        monthly_stats[m_key]["total_requests"] += 1
        monthly_stats[m_key]["total_amount"] += float(row.total_amount or 0)
        if row.status in (PaymentStatus.PAID, PaymentStatus.COMPLETED):
            monthly_stats[m_key]["paid_amount"] += float(row.total_amount or 0)

    # 4. Department distribution
    dept_q = (
        select(
            Department.name.label("department_name"),
            func.count(PaymentRequest.id).label("request_count"),
            func.coalesce(func.sum(PaymentRequest.total_amount), 0).label("total_amount"),
        )
        .join(PaymentRequest, PaymentRequest.department_id == Department.id)
        .group_by(Department.name)
        .order_by(desc("total_amount"))
        .limit(5)
    )
    dept_rows = (await db.execute(dept_q)).all()
    top_departments = [
        {"department": r.department_name, "count": r.request_count, "amount": float(r.total_amount)}
        for r in dept_rows
    ]

    # 5. Average Turnaround Time (in hours)
    turnaround_q = select(
        PaymentRequest.submitted_at,
        PaymentRequest.approved_at,
    ).where(
        and_(
            PaymentRequest.submitted_at.is_not(None),
            PaymentRequest.approved_at.is_not(None),
        )
    )
    turnaround_rows = (await db.execute(turnaround_q)).all()
    avg_turnaround_hours = 0.0
    if turnaround_rows:
        total_hours = sum(
            (r.approved_at - r.submitted_at).total_seconds() / 3600.0
            for r in turnaround_rows
            if r.approved_at and r.submitted_at and r.approved_at >= r.submitted_at
        )
        avg_turnaround_hours = round(total_hours / len(turnaround_rows), 2)

    # 6. Recent Requests (latest 10)
    recent_q = (
        select(PaymentRequest)
        .options(
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.vendor),
            selectinload(PaymentRequest.requested_by),
        )
        .order_by(PaymentRequest.created_at.desc())
        .limit(10)
    )
    recent_res = (await db.execute(recent_q)).scalars().all()
    recent_requests = [
        {
            "id": str(r.id),
            "request_number": r.request_number,
            "department": r.department.name if r.department else "-",
            "vendor": r.vendor.name if r.vendor else "-",
            "requested_by": r.requested_by.full_name if r.requested_by else "-",
            "total_amount": float(r.total_amount),
            "status": r.status.value,
            "priority": r.priority.value,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in recent_res
    ]

    return {
        "overview": {
            "total_requests": total_count,
            "total_amount": total_amount,
            "pending_approval_count": pending_info["count"],
            "pending_approval_amount": pending_info["amount"],
            "approved_count": approved_info["count"],
            "approved_amount": approved_info["amount"],
            "paid_count": paid_info["count"],
            "paid_amount": paid_info["amount"],
            "completed_count": completed_info["count"],
            "completed_amount": completed_info["amount"],
            "rejected_count": rejected_info["count"],
            "rejected_amount": rejected_info["amount"],
            "avg_approval_turnaround_hours": avg_turnaround_hours,
        },
        "status_breakdown": status_breakdown,
        "monthly_trend": sorted(monthly_stats.values(), key=lambda x: x["month"]),
        "top_departments": top_departments,
        "recent_requests": recent_requests,
    }


async def get_approver_dashboard(user_id: Union[str, uuid.UUID], db: AsyncSession) -> Dict[str, Any]:
    """
    Generate approver-specific dashboard stats: pending queues, priority counts,
    and urgent action items.
    """
    usr_uuid = uuid.UUID(str(user_id)) if not isinstance(user_id, uuid.UUID) else user_id

    # 1. Pending Approvals count & total amount assigned to this user
    pending_q = select(
        func.count(PaymentRequest.id).label("count"),
        func.coalesce(func.sum(PaymentRequest.total_amount), 0).label("amount"),
    ).where(
        and_(
            PaymentRequest.assigned_approver_id == usr_uuid,
            PaymentRequest.status == PaymentStatus.PENDING_APPROVAL,
        )
    )
    pending_res = (await db.execute(pending_q)).one()
    pending_count = pending_res.count or 0
    pending_amount = float(pending_res.amount or 0)

    # 2. Priority breakdown for pending approvals
    prio_q = select(
        PaymentRequest.priority,
        func.count(PaymentRequest.id).label("count"),
    ).where(
        and_(
            PaymentRequest.assigned_approver_id == usr_uuid,
            PaymentRequest.status == PaymentStatus.PENDING_APPROVAL,
        )
    ).group_by(PaymentRequest.priority)
    prio_rows = (await db.execute(prio_q)).all()
    priority_breakdown = {
        PaymentPriority.LOW.value: 0,
        PaymentPriority.NORMAL.value: 0,
        PaymentPriority.HIGH.value: 0,
        PaymentPriority.URGENT.value: 0,
    }
    for r in prio_rows:
        pkey = r.priority.value if hasattr(r.priority, "value") else str(r.priority)
        priority_breakdown[pkey] = r.count

    # 3. Total decisions executed by this approver
    decisions_q = select(
        ApprovalRecord.status,
        func.count(ApprovalRecord.id).label("count"),
    ).where(
        ApprovalRecord.approver_id == usr_uuid
    ).group_by(ApprovalRecord.status)
    decision_rows = (await db.execute(decisions_q)).all()
    approved_by_me = 0
    rejected_by_me = 0
    for r in decision_rows:
        if r.status == ApprovalStatus.APPROVED:
            approved_by_me = r.count
        elif r.status == ApprovalStatus.REJECTED:
            rejected_by_me = r.count

    # 4. Urgent / High Pending Approvals
    urgent_q = (
        select(PaymentRequest)
        .where(
            and_(
                PaymentRequest.assigned_approver_id == usr_uuid,
                PaymentRequest.status == PaymentStatus.PENDING_APPROVAL,
            )
        )
        .options(
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.vendor),
            selectinload(PaymentRequest.requested_by),
        )
        .order_by(
            case(
                (PaymentRequest.priority == PaymentPriority.URGENT, 1),
                (PaymentRequest.priority == PaymentPriority.HIGH, 2),
                (PaymentRequest.priority == PaymentPriority.NORMAL, 3),
                else_=4,
            ),
            PaymentRequest.due_date.asc().nulls_last(),
            PaymentRequest.submitted_at.asc(),
        )
        .limit(10)
    )
    urgent_res = (await db.execute(urgent_q)).scalars().all()
    urgent_list = [
        {
            "id": str(r.id),
            "request_number": r.request_number,
            "department": r.department.name if r.department else "-",
            "vendor": r.vendor.name if r.vendor else "-",
            "requested_by": r.requested_by.full_name if r.requested_by else "-",
            "purpose": r.payment_purpose[:50] + "..." if len(r.payment_purpose) > 50 else r.payment_purpose,
            "total_amount": float(r.total_amount),
            "priority": r.priority.value,
            "due_date": r.due_date.strftime("%Y-%m-%d") if r.due_date else None,
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
        }
        for r in urgent_res
    ]

    return {
        "pending_count": pending_count,
        "pending_amount": pending_amount,
        "priority_breakdown": priority_breakdown,
        "urgent_count": priority_breakdown[PaymentPriority.URGENT.value] + priority_breakdown[PaymentPriority.HIGH.value],
        "approved_count": approved_by_me,
        "rejected_count": rejected_by_me,
        "urgent_pending_requests": urgent_list,
    }


async def get_accountant_dashboard(user_id: Union[str, uuid.UUID], db: AsyncSession) -> Dict[str, Any]:
    """
    Generate accountant dashboard: disbursements pending, paid today/month,
    and payment mode distribution.
    """
    now = datetime.now(timezone.utc)
    today_start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
    month_start = datetime.combine(now.date().replace(day=1), time.min, tzinfo=timezone.utc)

    # 1. Approved requests awaiting disbursement (status == APPROVED)
    awaiting_q = select(
        func.count(PaymentRequest.id).label("count"),
        func.coalesce(func.sum(PaymentRequest.total_amount), 0).label("amount"),
    ).where(PaymentRequest.status == PaymentStatus.APPROVED)
    awaiting_res = (await db.execute(awaiting_q)).one()
    awaiting_count = awaiting_res.count or 0
    awaiting_amount = float(awaiting_res.amount or 0)

    # 2. Paid today
    paid_today_q = select(
        func.count(PaymentRecord.id).label("count"),
        func.coalesce(func.sum(PaymentRecord.actual_amount), 0).label("amount"),
    ).where(PaymentRecord.payment_date >= today_start)
    today_res = (await db.execute(paid_today_q)).one()
    paid_today_count = today_res.count or 0
    paid_today_amount = float(today_res.amount or 0)

    # 3. Paid this month
    paid_month_q = select(
        func.count(PaymentRecord.id).label("count"),
        func.coalesce(func.sum(PaymentRecord.actual_amount), 0).label("amount"),
    ).where(PaymentRecord.payment_date >= month_start)
    month_res = (await db.execute(paid_month_q)).one()
    paid_month_count = month_res.count or 0
    paid_month_amount = float(month_res.amount or 0)

    # 4. Total Completed requests
    completed_q = select(
        func.count(PaymentRequest.id).label("count"),
        func.coalesce(func.sum(PaymentRequest.total_amount), 0).label("amount"),
    ).where(PaymentRequest.status == PaymentStatus.COMPLETED)
    completed_res = (await db.execute(completed_q)).one()

    # 5. Payment mode breakdown
    modes_q = select(
        PaymentRecord.payment_mode,
        func.count(PaymentRecord.id).label("count"),
        func.coalesce(func.sum(PaymentRecord.actual_amount), 0).label("amount"),
    ).group_by(PaymentRecord.payment_mode)
    mode_rows = (await db.execute(modes_q)).all()
    mode_breakdown = {}
    for r in mode_rows:
        mkey = r.payment_mode.value if hasattr(r.payment_mode, "value") else str(r.payment_mode)
        mode_breakdown[mkey] = {
            "count": r.count,
            "amount": float(r.amount),
        }

    # 6. Top 10 Pending Disbursements (approved requests awaiting payment)
    pending_disb_q = (
        select(PaymentRequest)
        .where(PaymentRequest.status == PaymentStatus.APPROVED)
        .options(
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.vendor),
            selectinload(PaymentRequest.requested_by),
        )
        .order_by(
            case(
                (PaymentRequest.priority == PaymentPriority.URGENT, 1),
                (PaymentRequest.priority == PaymentPriority.HIGH, 2),
                (PaymentRequest.priority == PaymentPriority.NORMAL, 3),
                else_=4,
            ),
            PaymentRequest.due_date.asc().nulls_last(),
            PaymentRequest.approved_at.asc(),
        )
        .limit(10)
    )
    pending_disb_res = (await db.execute(pending_disb_q)).scalars().all()
    pending_disbursement_list = [
        {
            "id": str(r.id),
            "request_number": r.request_number,
            "department": r.department.name if r.department else "-",
            "vendor": r.vendor.name if r.vendor else "-",
            "bank_account": r.bank_account or "-",
            "payment_mode": r.payment_mode.value,
            "total_amount": float(r.total_amount),
            "due_date": r.due_date.strftime("%Y-%m-%d") if r.due_date else None,
            "approved_at": r.approved_at.strftime("%Y-%m-%d %H:%M") if r.approved_at else None,
            "priority": r.priority.value,
        }
        for r in pending_disb_res
    ]

    return {
        "awaiting_disbursement_count": awaiting_count,
        "awaiting_disbursement_amount": awaiting_amount,
        "paid_today_count": paid_today_count,
        "paid_today_amount": paid_today_amount,
        "paid_this_month_count": paid_month_count,
        "paid_this_month_amount": paid_month_amount,
        "completed_count": completed_res.count or 0,
        "completed_amount": float(completed_res.amount or 0),
        "payment_mode_breakdown": mode_breakdown,
        "pending_disbursements": pending_disbursement_list,
    }


# ==============================================================================
# REPORT GENERATION (12 REPORT TYPES)
# ==============================================================================

def _apply_base_filters(
    query,
    filters: Dict[str, Any],
    model: Any = PaymentRequest,
):
    """Apply common query filters: date ranges, company, department, amount, etc."""
    start_date = _parse_date(filters.get("start_date"))
    end_date = _parse_date(filters.get("end_date"))
    if end_date:
        # Extend end_date to end of day if time was 00:00
        if end_date.time() == time.min:
            end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)

    if start_date:
        query = query.where(model.created_at >= start_date)
    if end_date:
        query = query.where(model.created_at <= end_date)

    company_id = filters.get("company_id")
    if company_id:
        c_uuid = uuid.UUID(str(company_id)) if not isinstance(company_id, uuid.UUID) else company_id
        query = query.where(model.company_id == c_uuid)

    department_id = filters.get("department_id")
    if department_id:
        d_uuid = uuid.UUID(str(department_id)) if not isinstance(department_id, uuid.UUID) else department_id
        query = query.where(model.department_id == d_uuid)

    vendor_id = filters.get("vendor_id")
    if vendor_id:
        v_uuid = uuid.UUID(str(vendor_id)) if not isinstance(vendor_id, uuid.UUID) else vendor_id
        query = query.where(model.vendor_id == v_uuid)

    min_amount = filters.get("min_amount")
    if min_amount is not None:
        query = query.where(model.total_amount >= Decimal(str(min_amount)))

    max_amount = filters.get("max_amount")
    if max_amount is not None:
        query = query.where(model.total_amount <= Decimal(str(max_amount)))

    priority = filters.get("priority")
    if priority:
        if isinstance(priority, str):
            try:
                priority = PaymentPriority(priority)
            except ValueError:
                pass
        query = query.where(model.priority == priority)

    category = filters.get("category")
    if category:
        if isinstance(category, str):
            try:
                category = ExpenseCategory(category)
            except ValueError:
                pass
        query = query.where(model.expense_category == category)

    return query


async def generate_report(
    report_type: str,
    filters: Optional[Dict[str, Any]],
    db: AsyncSession,
) -> Dict[str, Any]:
    """
    Generate one of the 12 specified business reports:
    1. pending_approval
    2. approved
    3. rejected
    4. payment_pending
    5. completed
    6. category_wise
    7. vendor_wise
    8. monthly
    9. department_wise
    10. approval_time
    11. threshold_exceptions
    12. cancelled
    """
    filters = filters or {}
    report_type_clean = report_type.lower().strip()

    generator_map = {
        "pending_approval": _report_pending_approval,
        "approved": _report_approved,
        "rejected": _report_rejected,
        "payment_pending": _report_payment_pending,
        "completed": _report_completed,
        "cancelled": _report_cancelled,
        "category_wise": _report_category_wise,
        "vendor_wise": _report_vendor_wise,
        "monthly": _report_monthly,
        "department_wise": _report_department_wise,
        "approval_time": _report_approval_time,
        "threshold_exceptions": _report_threshold_exceptions,
    }

    if report_type_clean not in generator_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unknown report type: '{report_type}'. Supported types: "
                f"{', '.join(generator_map.keys())}."
            ),
        )

    handler = generator_map[report_type_clean]
    return await handler(filters, db)


# ------------------------------------------------------------------------------
# 1. PENDING APPROVAL REPORT
# ------------------------------------------------------------------------------
async def _report_pending_approval(filters: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
    query = (
        select(PaymentRequest)
        .where(PaymentRequest.status == PaymentStatus.PENDING_APPROVAL)
        .options(
            selectinload(PaymentRequest.company),
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.vendor),
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
        )
    )
    query = _apply_base_filters(query, filters)
    query = query.order_by(PaymentRequest.submitted_at.asc())

    result = await db.execute(query)
    requests = result.scalars().all()

    columns = [
        {"key": "request_number", "label": "Request #"},
        {"key": "submitted_date", "label": "Submitted Date"},
        {"key": "company", "label": "Company"},
        {"key": "department", "label": "Department"},
        {"key": "vendor", "label": "Vendor"},
        {"key": "purpose", "label": "Purpose"},
        {"key": "priority", "label": "Priority"},
        {"key": "amount", "label": "Net Amount"},
        {"key": "gst_amount", "label": "GST Amount"},
        {"key": "total_amount", "label": "Total Amount"},
        {"key": "requested_by", "label": "Requester"},
        {"key": "assigned_approver", "label": "Assigned Approver"},
        {"key": "due_date", "label": "Due Date"},
    ]

    rows = []
    total_val = Decimal("0.00")
    for r in requests:
        total_val += r.total_amount
        rows.append({
            "request_number": r.request_number,
            "submitted_date": _format_cell_value(r.submitted_at),
            "company": r.company.name if r.company else "-",
            "department": r.department.name if r.department else "-",
            "vendor": r.vendor.name if r.vendor else "-",
            "purpose": r.payment_purpose,
            "priority": r.priority.value,
            "amount": float(r.amount),
            "gst_amount": float(r.gst_amount),
            "total_amount": float(r.total_amount),
            "requested_by": r.requested_by.full_name if r.requested_by else "-",
            "assigned_approver": r.assigned_approver.full_name if r.assigned_approver else "Unassigned",
            "due_date": _format_cell_value(r.due_date),
        })

    return {
        "report_type": "pending_approval",
        "title": "Pending Approval Report",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(rows),
        "summary": {
            "total_pending_requests": len(rows),
            "total_pending_amount": float(total_val),
        },
        "columns": columns,
        "rows": rows,
    }


# ------------------------------------------------------------------------------
# 2. APPROVED REPORT
# ------------------------------------------------------------------------------
async def _report_approved(filters: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
    query = (
        select(PaymentRequest)
        .where(PaymentRequest.status.in_([PaymentStatus.APPROVED, PaymentStatus.PAID, PaymentStatus.COMPLETED]))
        .options(
            selectinload(PaymentRequest.company),
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.vendor),
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
        )
    )
    query = _apply_base_filters(query, filters)
    query = query.order_by(PaymentRequest.approved_at.desc().nulls_last())

    result = await db.execute(query)
    requests = result.scalars().all()

    columns = [
        {"key": "request_number", "label": "Request #"},
        {"key": "approved_date", "label": "Approved Date"},
        {"key": "company", "label": "Company"},
        {"key": "department", "label": "Department"},
        {"key": "vendor", "label": "Vendor"},
        {"key": "purpose", "label": "Purpose"},
        {"key": "total_amount", "label": "Total Amount"},
        {"key": "requested_by", "label": "Requester"},
        {"key": "approved_by", "label": "Approved By"},
        {"key": "current_status", "label": "Current Status"},
    ]

    rows = []
    total_val = Decimal("0.00")
    for r in requests:
        total_val += r.total_amount
        rows.append({
            "request_number": r.request_number,
            "approved_date": _format_cell_value(r.approved_at),
            "company": r.company.name if r.company else "-",
            "department": r.department.name if r.department else "-",
            "vendor": r.vendor.name if r.vendor else "-",
            "purpose": r.payment_purpose,
            "total_amount": float(r.total_amount),
            "requested_by": r.requested_by.full_name if r.requested_by else "-",
            "approved_by": r.assigned_approver.full_name if r.assigned_approver else "-",
            "current_status": r.status.value,
        })

    return {
        "report_type": "approved",
        "title": "Approved Payments Report",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(rows),
        "summary": {
            "total_approved_requests": len(rows),
            "total_approved_amount": float(total_val),
        },
        "columns": columns,
        "rows": rows,
    }


# ------------------------------------------------------------------------------
# 3. REJECTED REPORT
# ------------------------------------------------------------------------------
async def _report_rejected(filters: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
    query = (
        select(PaymentRequest)
        .where(PaymentRequest.status == PaymentStatus.REJECTED)
        .options(
            selectinload(PaymentRequest.company),
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.vendor),
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
            selectinload(PaymentRequest.approval_records),
        )
    )
    query = _apply_base_filters(query, filters)
    query = query.order_by(PaymentRequest.rejected_at.desc().nulls_last())

    result = await db.execute(query)
    requests = result.scalars().all()

    columns = [
        {"key": "request_number", "label": "Request #"},
        {"key": "rejected_date", "label": "Rejected Date"},
        {"key": "company", "label": "Company"},
        {"key": "department", "label": "Department"},
        {"key": "vendor", "label": "Vendor"},
        {"key": "purpose", "label": "Purpose"},
        {"key": "total_amount", "label": "Total Amount"},
        {"key": "requested_by", "label": "Requester"},
        {"key": "rejected_by", "label": "Rejected By"},
        {"key": "rejection_reason", "label": "Rejection Reason"},
    ]

    rows = []
    total_val = Decimal("0.00")
    for r in requests:
        total_val += r.total_amount
        reason = "-"
        if r.approval_records:
            rejections = [rec.comment for rec in r.approval_records if rec.status == ApprovalStatus.REJECTED and rec.comment]
            if rejections:
                reason = rejections[-1]

        rows.append({
            "request_number": r.request_number,
            "rejected_date": _format_cell_value(r.rejected_at),
            "company": r.company.name if r.company else "-",
            "department": r.department.name if r.department else "-",
            "vendor": r.vendor.name if r.vendor else "-",
            "purpose": r.payment_purpose,
            "total_amount": float(r.total_amount),
            "requested_by": r.requested_by.full_name if r.requested_by else "-",
            "rejected_by": r.assigned_approver.full_name if r.assigned_approver else "-",
            "rejection_reason": reason,
        })

    return {
        "report_type": "rejected",
        "title": "Rejected Requests Report",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(rows),
        "summary": {
            "total_rejected_requests": len(rows),
            "total_rejected_amount": float(total_val),
        },
        "columns": columns,
        "rows": rows,
    }


# ------------------------------------------------------------------------------
# 4. PAYMENT PENDING REPORT
# ------------------------------------------------------------------------------
async def _report_payment_pending(filters: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
    query = (
        select(PaymentRequest)
        .where(PaymentRequest.status == PaymentStatus.APPROVED)
        .options(
            selectinload(PaymentRequest.company),
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.vendor),
            selectinload(PaymentRequest.requested_by),
        )
    )
    query = _apply_base_filters(query, filters)
    query = query.order_by(PaymentRequest.due_date.asc().nulls_last(), PaymentRequest.approved_at.asc())

    result = await db.execute(query)
    requests = result.scalars().all()

    columns = [
        {"key": "request_number", "label": "Request #"},
        {"key": "approved_date", "label": "Approved Date"},
        {"key": "due_date", "label": "Due Date"},
        {"key": "company", "label": "Company"},
        {"key": "department", "label": "Department"},
        {"key": "vendor", "label": "Vendor"},
        {"key": "purpose", "label": "Purpose"},
        {"key": "payment_mode", "label": "Payment Mode"},
        {"key": "bank_account", "label": "Target Bank Account"},
        {"key": "total_amount", "label": "Total Amount"},
        {"key": "requested_by", "label": "Requester"},
    ]

    rows = []
    total_val = Decimal("0.00")
    for r in requests:
        total_val += r.total_amount
        rows.append({
            "request_number": r.request_number,
            "approved_date": _format_cell_value(r.approved_at),
            "due_date": _format_cell_value(r.due_date),
            "company": r.company.name if r.company else "-",
            "department": r.department.name if r.department else "-",
            "vendor": r.vendor.name if r.vendor else "-",
            "purpose": r.payment_purpose,
            "payment_mode": r.payment_mode.value,
            "bank_account": r.bank_account or "-",
            "total_amount": float(r.total_amount),
            "requested_by": r.requested_by.full_name if r.requested_by else "-",
        })

    return {
        "report_type": "payment_pending",
        "title": "Payment Pending Disbursement Report",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(rows),
        "summary": {
            "total_pending_disbursements": len(rows),
            "total_disbursement_amount": float(total_val),
        },
        "columns": columns,
        "rows": rows,
    }


# ------------------------------------------------------------------------------
# 5. COMPLETED REPORT
# ------------------------------------------------------------------------------
async def _report_completed(filters: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
    query = (
        select(PaymentRequest)
        .where(PaymentRequest.status == PaymentStatus.COMPLETED)
        .options(
            selectinload(PaymentRequest.company),
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.vendor),
            selectinload(PaymentRequest.payment_records),
        )
    )
    query = _apply_base_filters(query, filters)
    query = query.order_by(PaymentRequest.completed_at.desc().nulls_last())

    result = await db.execute(query)
    requests = result.scalars().all()

    columns = [
        {"key": "request_number", "label": "Request #"},
        {"key": "completed_date", "label": "Completed Date"},
        {"key": "paid_date", "label": "Paid Date"},
        {"key": "company", "label": "Company"},
        {"key": "department", "label": "Department"},
        {"key": "vendor", "label": "Vendor"},
        {"key": "total_amount", "label": "Invoice Total"},
        {"key": "paid_amount", "label": "Disbursed Amount"},
        {"key": "payment_mode", "label": "Payment Mode"},
        {"key": "utr_number", "label": "UTR / Transaction ID"},
    ]

    rows = []
    total_val = Decimal("0.00")
    for r in requests:
        total_val += r.total_amount
        rec = r.payment_records[-1] if r.payment_records else None
        rows.append({
            "request_number": r.request_number,
            "completed_date": _format_cell_value(r.completed_at),
            "paid_date": _format_cell_value(r.paid_at),
            "company": r.company.name if r.company else "-",
            "department": r.department.name if r.department else "-",
            "vendor": r.vendor.name if r.vendor else "-",
            "total_amount": float(r.total_amount),
            "paid_amount": float(rec.actual_amount) if rec else float(r.total_amount),
            "payment_mode": rec.payment_mode.value if rec else r.payment_mode.value,
            "utr_number": (rec.utr_number or rec.transaction_id or rec.payment_reference or "-") if rec else "-",
        })

    return {
        "report_type": "completed",
        "title": "Completed Payments Report",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(rows),
        "summary": {
            "total_completed_requests": len(rows),
            "total_completed_amount": float(total_val),
        },
        "columns": columns,
        "rows": rows,
    }


# ------------------------------------------------------------------------------
# 6. CANCELLED REPORT
# ------------------------------------------------------------------------------
async def _report_cancelled(filters: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
    query = (
        select(PaymentRequest)
        .where(PaymentRequest.status == PaymentStatus.CANCELLED)
        .options(
            selectinload(PaymentRequest.company),
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.vendor),
            selectinload(PaymentRequest.requested_by),
        )
    )
    query = _apply_base_filters(query, filters)
    query = query.order_by(PaymentRequest.updated_at.desc())

    result = await db.execute(query)
    requests = result.scalars().all()

    columns = [
        {"key": "request_number", "label": "Request #"},
        {"key": "created_date", "label": "Created Date"},
        {"key": "company", "label": "Company"},
        {"key": "department", "label": "Department"},
        {"key": "vendor", "label": "Vendor"},
        {"key": "purpose", "label": "Purpose"},
        {"key": "total_amount", "label": "Total Amount"},
        {"key": "requested_by", "label": "Requester"},
    ]

    rows = []
    total_val = Decimal("0.00")
    for r in requests:
        total_val += r.total_amount
        rows.append({
            "request_number": r.request_number,
            "created_date": _format_cell_value(r.created_at),
            "company": r.company.name if r.company else "-",
            "department": r.department.name if r.department else "-",
            "vendor": r.vendor.name if r.vendor else "-",
            "purpose": r.payment_purpose,
            "total_amount": float(r.total_amount),
            "requested_by": r.requested_by.full_name if r.requested_by else "-",
        })

    return {
        "report_type": "cancelled",
        "title": "Cancelled Requests Report",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(rows),
        "summary": {
            "total_cancelled_requests": len(rows),
            "total_cancelled_amount": float(total_val),
        },
        "columns": columns,
        "rows": rows,
    }


# ------------------------------------------------------------------------------
# 7. CATEGORY-WISE REPORT
# ------------------------------------------------------------------------------
async def _report_category_wise(filters: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
    query = select(
        PaymentRequest.expense_category,
        func.count(PaymentRequest.id).label("total_count"),
        func.coalesce(func.sum(PaymentRequest.total_amount), 0).label("total_amount"),
        func.coalesce(func.avg(PaymentRequest.total_amount), 0).label("avg_amount"),
        func.coalesce(func.max(PaymentRequest.total_amount), 0).label("max_amount"),
        func.coalesce(func.min(PaymentRequest.total_amount), 0).label("min_amount"),
    ).group_by(PaymentRequest.expense_category)

    query = _apply_base_filters(query, filters)
    query = query.order_by(desc("total_amount"))

    result = await db.execute(query)
    cats = result.all()

    overall_sum = sum(float(r.total_amount) for r in cats)
    overall_count = sum(r.total_count for r in cats)

    columns = [
        {"key": "category", "label": "Expense Category"},
        {"key": "total_count", "label": "Total Requests"},
        {"key": "total_amount", "label": "Total Amount"},
        {"key": "avg_amount", "label": "Average Amount"},
        {"key": "max_amount", "label": "Max Amount"},
        {"key": "min_amount", "label": "Min Amount"},
        {"key": "percentage", "label": "Share (%)"},
    ]

    rows = []
    for r in cats:
        cat_amount = float(r.total_amount)
        pct = round((cat_amount / overall_sum * 100.0), 2) if overall_sum > 0 else 0.0
        rows.append({
            "category": r.expense_category.value if hasattr(r.expense_category, "value") else str(r.expense_category),
            "total_count": r.total_count,
            "total_amount": cat_amount,
            "avg_amount": round(float(r.avg_amount), 2),
            "max_amount": float(r.max_amount),
            "min_amount": float(r.min_amount),
            "percentage": pct,
        })

    return {
        "report_type": "category_wise",
        "title": "Expense Category-Wise Expenditure Report",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(rows),
        "summary": {
            "total_categories": len(rows),
            "grand_total_amount": overall_sum,
            "grand_total_requests": overall_count,
        },
        "columns": columns,
        "rows": rows,
    }


# ------------------------------------------------------------------------------
# 8. VENDOR-WISE REPORT
# ------------------------------------------------------------------------------
async def _report_vendor_wise(filters: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
    query = (
        select(
            Vendor.id.label("vendor_id"),
            Vendor.name.label("vendor_name"),
            Vendor.code.label("vendor_code"),
            Vendor.gst_number.label("gst_number"),
            func.count(PaymentRequest.id).label("total_requests"),
            func.coalesce(func.sum(PaymentRequest.total_amount), 0).label("total_amount"),
            func.coalesce(
                func.sum(
                    case(
                        (PaymentRequest.status.in_([PaymentStatus.PAID, PaymentStatus.COMPLETED]), PaymentRequest.total_amount),
                        else_=0,
                    )
                ),
                0,
            ).label("disbursed_amount"),
            func.coalesce(
                func.sum(
                    case(
                        (PaymentRequest.status == PaymentStatus.APPROVED, PaymentRequest.total_amount),
                        else_=0,
                    )
                ),
                0,
            ).label("pending_disbursement"),
        )
        .outerjoin(PaymentRequest, PaymentRequest.vendor_id == Vendor.id)
        .group_by(Vendor.id, Vendor.name, Vendor.code, Vendor.gst_number)
    )

    query = _apply_base_filters(query, filters, model=PaymentRequest)
    query = query.order_by(desc("total_amount"))

    result = await db.execute(query)
    vendor_rows = result.all()

    columns = [
        {"key": "vendor_name", "label": "Vendor Name"},
        {"key": "vendor_code", "label": "Vendor Code"},
        {"key": "gst_number", "label": "GST Number"},
        {"key": "total_requests", "label": "Total Requests"},
        {"key": "total_amount", "label": "Total Invoiced Amount"},
        {"key": "disbursed_amount", "label": "Disbursed Amount"},
        {"key": "pending_disbursement", "label": "Pending Disbursement"},
    ]

    rows = []
    grand_total = 0.0
    grand_disbursed = 0.0
    for r in vendor_rows:
        if r.total_requests == 0 and not filters.get("include_zero_spend"):
            continue
        tot = float(r.total_amount)
        disb = float(r.disbursed_amount)
        grand_total += tot
        grand_disbursed += disb
        rows.append({
            "vendor_name": r.vendor_name,
            "vendor_code": r.vendor_code,
            "gst_number": r.gst_number or "-",
            "total_requests": r.total_requests,
            "total_amount": tot,
            "disbursed_amount": disb,
            "pending_disbursement": float(r.pending_disbursement),
        })

    return {
        "report_type": "vendor_wise",
        "title": "Vendor-Wise Expenditure & Disbursement Report",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(rows),
        "summary": {
            "total_vendors": len(rows),
            "grand_total_invoiced": grand_total,
            "grand_total_disbursed": grand_disbursed,
        },
        "columns": columns,
        "rows": rows,
    }


# ------------------------------------------------------------------------------
# 9. MONTHLY REPORT
# ------------------------------------------------------------------------------
async def _report_monthly(filters: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
    query = select(PaymentRequest)
    query = _apply_base_filters(query, filters)
    query = query.order_by(PaymentRequest.created_at.asc())

    result = await db.execute(query)
    requests = result.scalars().all()

    monthly_map: Dict[str, Dict[str, Any]] = {}
    for r in requests:
        if not r.created_at:
            continue
        m_key = r.created_at.strftime("%Y-%m")
        if m_key not in monthly_map:
            monthly_map[m_key] = {
                "month": m_key,
                "total_requests": 0,
                "total_amount": 0.0,
                "approved_count": 0,
                "approved_amount": 0.0,
                "paid_count": 0,
                "paid_amount": 0.0,
                "rejected_count": 0,
                "rejected_amount": 0.0,
            }

        rec = monthly_map[m_key]
        rec["total_requests"] += 1
        rec["total_amount"] += float(r.total_amount)

        if r.status in (PaymentStatus.APPROVED, PaymentStatus.PAID, PaymentStatus.COMPLETED):
            rec["approved_count"] += 1
            rec["approved_amount"] += float(r.total_amount)
        if r.status in (PaymentStatus.PAID, PaymentStatus.COMPLETED):
            rec["paid_count"] += 1
            rec["paid_amount"] += float(r.total_amount)
        if r.status == PaymentStatus.REJECTED:
            rec["rejected_count"] += 1
            rec["rejected_amount"] += float(r.total_amount)

    sorted_months = sorted(monthly_map.values(), key=lambda x: x["month"])

    columns = [
        {"key": "month", "label": "Month"},
        {"key": "total_requests", "label": "Total Requests"},
        {"key": "total_amount", "label": "Total Requested Amount"},
        {"key": "approved_count", "label": "Approved Count"},
        {"key": "approved_amount", "label": "Approved Amount"},
        {"key": "paid_count", "label": "Paid Count"},
        {"key": "paid_amount", "label": "Paid Amount"},
        {"key": "rejected_count", "label": "Rejected Count"},
    ]

    return {
        "report_type": "monthly",
        "title": "Monthly Cash Outflow & Approval Trends Report",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(sorted_months),
        "summary": {
            "total_months": len(sorted_months),
            "grand_total_spend": sum(m["total_amount"] for m in sorted_months),
            "grand_paid_spend": sum(m["paid_amount"] for m in sorted_months),
        },
        "columns": columns,
        "rows": sorted_months,
    }


# ------------------------------------------------------------------------------
# 10. DEPARTMENT-WISE REPORT
# ------------------------------------------------------------------------------
async def _report_department_wise(filters: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
    query = (
        select(
            Department.id.label("department_id"),
            Department.name.label("department_name"),
            Department.code.label("department_code"),
            func.count(PaymentRequest.id).label("total_requests"),
            func.coalesce(func.sum(PaymentRequest.total_amount), 0).label("total_amount"),
            func.coalesce(
                func.sum(
                    case(
                        (PaymentRequest.status.in_([PaymentStatus.APPROVED, PaymentStatus.PAID, PaymentStatus.COMPLETED]), PaymentRequest.total_amount),
                        else_=0,
                    )
                ),
                0,
            ).label("approved_amount"),
            func.coalesce(
                func.sum(
                    case(
                        (PaymentRequest.status == PaymentStatus.PENDING_APPROVAL, 1),
                        else_=0,
                    )
                ),
                0,
            ).label("pending_count"),
        )
        .outerjoin(PaymentRequest, PaymentRequest.department_id == Department.id)
        .group_by(Department.id, Department.name, Department.code)
    )

    query = _apply_base_filters(query, filters, model=PaymentRequest)
    query = query.order_by(desc("total_amount"))

    result = await db.execute(query)
    dept_rows = result.all()

    columns = [
        {"key": "department_name", "label": "Department Name"},
        {"key": "department_code", "label": "Code"},
        {"key": "total_requests", "label": "Total Requests"},
        {"key": "total_amount", "label": "Total Budget Requested"},
        {"key": "approved_amount", "label": "Approved Amount"},
        {"key": "pending_count", "label": "Pending Approvals"},
    ]

    rows = []
    grand_total = 0.0
    grand_approved = 0.0
    for r in dept_rows:
        if r.total_requests == 0 and not filters.get("include_zero_spend"):
            continue
        tot = float(r.total_amount)
        app = float(r.approved_amount)
        grand_total += tot
        grand_approved += app
        rows.append({
            "department_name": r.department_name,
            "department_code": r.department_code,
            "total_requests": r.total_requests,
            "total_amount": tot,
            "approved_amount": app,
            "pending_count": r.pending_count,
        })

    return {
        "report_type": "department_wise",
        "title": "Department-Wise Expenditure & Budget Report",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(rows),
        "summary": {
            "total_departments": len(rows),
            "grand_total_amount": grand_total,
            "grand_approved_amount": grand_approved,
        },
        "columns": columns,
        "rows": rows,
    }


# ------------------------------------------------------------------------------
# 11. APPROVAL TIME REPORT
# ------------------------------------------------------------------------------
async def _report_approval_time(filters: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
    query = (
        select(PaymentRequest)
        .where(
            and_(
                PaymentRequest.submitted_at.is_not(None),
                or_(
                    PaymentRequest.approved_at.is_not(None),
                    PaymentRequest.rejected_at.is_not(None),
                ),
            )
        )
        .options(
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
        )
    )
    query = _apply_base_filters(query, filters)
    query = query.order_by(PaymentRequest.submitted_at.desc())

    result = await db.execute(query)
    requests = result.scalars().all()

    columns = [
        {"key": "request_number", "label": "Request #"},
        {"key": "department", "label": "Department"},
        {"key": "requested_by", "label": "Requester"},
        {"key": "assigned_approver", "label": "Approver"},
        {"key": "submitted_at", "label": "Submitted Date"},
        {"key": "decision_at", "label": "Decision Date"},
        {"key": "decision_status", "label": "Decision"},
        {"key": "turnaround_hours", "label": "Turnaround (Hours)"},
        {"key": "total_amount", "label": "Amount"},
    ]

    rows = []
    total_hours = 0.0
    min_hours = float("inf")
    max_hours = 0.0

    for r in requests:
        decision_dt = r.approved_at or r.rejected_at
        if not decision_dt or not r.submitted_at:
            continue
        delta = (decision_dt - r.submitted_at).total_seconds() / 3600.0
        delta = max(delta, 0.0)
        total_hours += delta
        min_hours = min(min_hours, delta)
        max_hours = max(max_hours, delta)

        rows.append({
            "request_number": r.request_number,
            "department": r.department.name if r.department else "-",
            "requested_by": r.requested_by.full_name if r.requested_by else "-",
            "assigned_approver": r.assigned_approver.full_name if r.assigned_approver else "-",
            "submitted_at": _format_cell_value(r.submitted_at),
            "decision_at": _format_cell_value(decision_dt),
            "decision_status": "APPROVED" if r.approved_at else "REJECTED",
            "turnaround_hours": round(delta, 2),
            "total_amount": float(r.total_amount),
        })

    avg_turnaround = round(total_hours / len(rows), 2) if rows else 0.0
    if min_hours == float("inf"):
        min_hours = 0.0

    return {
        "report_type": "approval_time",
        "title": "Approval Turnaround Time Analysis Report",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(rows),
        "summary": {
            "evaluated_requests_count": len(rows),
            "average_turnaround_hours": avg_turnaround,
            "min_turnaround_hours": round(min_hours, 2),
            "max_turnaround_hours": round(max_hours, 2),
        },
        "columns": columns,
        "rows": rows,
    }


# ------------------------------------------------------------------------------
# 12. THRESHOLD EXCEPTIONS REPORT
# ------------------------------------------------------------------------------
async def _report_threshold_exceptions(filters: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
    threshold_limit = filters.get("threshold_amount", 50000.0)
    limit_dec = Decimal(str(threshold_limit))

    query = (
        select(PaymentRequest)
        .where(
            or_(
                PaymentRequest.is_duplicate_override == True,
                PaymentRequest.total_amount >= limit_dec,
            )
        )
        .options(
            selectinload(PaymentRequest.company),
            selectinload(PaymentRequest.department),
            selectinload(PaymentRequest.vendor),
            selectinload(PaymentRequest.requested_by),
            selectinload(PaymentRequest.assigned_approver),
        )
    )
    query = _apply_base_filters(query, filters)
    query = query.order_by(PaymentRequest.total_amount.desc())

    result = await db.execute(query)
    requests = result.scalars().all()

    columns = [
        {"key": "request_number", "label": "Request #"},
        {"key": "company", "label": "Company"},
        {"key": "department", "label": "Department"},
        {"key": "vendor", "label": "Vendor"},
        {"key": "total_amount", "label": "Total Amount"},
        {"key": "priority", "label": "Priority"},
        {"key": "is_duplicate_override", "label": "Duplicate Override"},
        {"key": "duplicate_override_reason", "label": "Override Reason"},
        {"key": "approver", "label": "Approver"},
        {"key": "status", "label": "Status"},
    ]

    rows = []
    total_val = Decimal("0.00")
    for r in requests:
        total_val += r.total_amount
        rows.append({
            "request_number": r.request_number,
            "company": r.company.name if r.company else "-",
            "department": r.department.name if r.department else "-",
            "vendor": r.vendor.name if r.vendor else "-",
            "total_amount": float(r.total_amount),
            "priority": r.priority.value,
            "is_duplicate_override": "Yes" if r.is_duplicate_override else "No",
            "duplicate_override_reason": r.duplicate_override_reason or "-",
            "approver": r.assigned_approver.full_name if r.assigned_approver else "-",
            "status": r.status.value,
        })

    return {
        "report_type": "threshold_exceptions",
        "title": "Approval Threshold Exceptions & Policy Override Report",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(rows),
        "summary": {
            "total_exceptions": len(rows),
            "total_exception_amount": float(total_val),
            "threshold_limit_applied": float(threshold_limit),
        },
        "columns": columns,
        "rows": rows,
    }


# ==============================================================================
# EXPORT SERVICES (EXCEL & CSV)
# ==============================================================================

def export_to_excel(
    data: Union[Dict[str, Any], List[Dict[str, Any]]],
    report_type: str = "report",
) -> bytes:
    """
    Export structured report data or dictionary results into an executive-styled
    Excel spreadsheet (.xlsx) workbook.
    """
    wb = openpyxl.Workbook()
    ws = wb.active

    clean_title = re.sub(r"[\\/*?:\[\]]", "_", report_type)[:31] or "Report"
    ws.title = clean_title

    # Extract headers and rows
    columns: List[Dict[str, str]] = []
    rows: List[Dict[str, Any]] = []
    summary_data: Dict[str, Any] = {}
    report_title = f"{report_type.replace('_', ' ').title()} Report"
    generated_at_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    if isinstance(data, dict):
        report_title = data.get("title", report_title)
        generated_at_str = data.get("generated_at", generated_at_str)
        summary_data = data.get("summary", {})
        raw_cols = data.get("columns", [])
        for c in raw_cols:
            if isinstance(c, dict):
                columns.append(c)
            elif isinstance(c, str):
                columns.append({"key": c, "label": c.replace("_", " ").title()})
        rows = data.get("rows", [])
    elif isinstance(data, list):
        if data and isinstance(data[0], dict):
            for k in data[0].keys():
                columns.append({"key": k, "label": k.replace("_", " ").title()})
            rows = data
        else:
            rows = []

    # Styling definitions
    brand_blue = "1E3A8A"       # Primary dark navy
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color=brand_blue, end_color=brand_blue, fill_type="solid")
    
    title_font = Font(name="Segoe UI", size=16, bold=True, color="1E3A8A")
    subtitle_font = Font(name="Segoe UI", size=9, italic=True, color="6B7280")
    
    summary_key_font = Font(name="Segoe UI", size=10, bold=True, color="374151")
    summary_val_font = Font(name="Segoe UI", size=10, bold=False, color="111827")
    summary_fill = PatternFill(start_color="F3F4F6", end_color="F3F4F6", fill_type="solid")
    
    data_font = Font(name="Segoe UI", size=10)
    zebra_fill = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")
    
    thin_border_side = Side(style="thin", color="E5E7EB")
    cell_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)
    
    current_row = 1

    # 1. Title Block
    ws.cell(row=current_row, column=1, value=report_title).font = title_font
    current_row += 1
    ws.cell(row=current_row, column=1, value=f"Generated: {generated_at_str} | Total Records: {len(rows)}").font = subtitle_font
    current_row += 2

    # 2. Summary Block (if present)
    if summary_data:
        ws.cell(row=current_row, column=1, value="Report Summary").font = summary_key_font
        current_row += 1
        for k, v in summary_data.items():
            k_cell = ws.cell(row=current_row, column=1, value=k.replace("_", " ").title())
            k_cell.font = summary_key_font
            k_cell.fill = summary_fill
            k_cell.border = cell_border

            v_cell = ws.cell(row=current_row, column=2, value=_format_cell_value(v))
            v_cell.font = summary_val_font
            v_cell.fill = summary_fill
            v_cell.border = cell_border
            if isinstance(v, (int, float, Decimal)) and "amount" in k.lower():
                v_cell.number_format = "#,##0.00"
            current_row += 1
        current_row += 1

    # 3. Main Data Table Headers
    if columns:
        for col_idx, col_meta in enumerate(columns, start=1):
            cell = ws.cell(row=current_row, column=col_idx, value=col_meta["label"])
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = cell_border
        ws.row_dimensions[current_row].height = 26
        current_row += 1

        # 4. Table Rows
        for r_idx, row_dict in enumerate(rows):
            is_even = (r_idx % 2 == 0)
            ws.row_dimensions[current_row].height = 20

            for col_idx, col_meta in enumerate(columns, start=1):
                raw_val = row_dict.get(col_meta["key"])
                cell = ws.cell(row=current_row, column=col_idx)
                cell.font = data_font
                cell.border = cell_border

                if is_even:
                    cell.fill = zebra_fill

                if isinstance(raw_val, (int, float, Decimal)):
                    cell.value = float(raw_val)
                    if any(term in col_meta["key"].lower() for term in ("amount", "total", "budget", "spend")):
                        cell.number_format = "#,##0.00"
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                else:
                    cell.value = _format_cell_value(raw_val)
                    cell.alignment = Alignment(horizontal="left", vertical="center")

            current_row += 1

        # 5. Auto-fit column widths
        for col_idx, col_meta in enumerate(columns, start=1):
            col_letter = get_column_letter(col_idx)
            header_len = len(str(col_meta["label"]))
            max_data_len = max(
                (len(str(_format_cell_value(r.get(col_meta["key"])))) for r in rows[:100]),
                default=0,
            )
            calc_width = max(header_len, max_data_len) + 4
            ws.column_dimensions[col_letter].width = max(min(calc_width, 45), 12)

    # Save to BytesIO
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


def export_to_csv(
    data: Union[Dict[str, Any], List[Dict[str, Any]]],
    report_type: str = "report",
) -> bytes:
    """
    Export structured report data into a RFC-4180 compliant CSV byte stream
    with UTF-8 Byte Order Mark (BOM) for seamless Excel desktop compatibility.
    """
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    columns: List[Dict[str, str]] = []
    rows: List[Dict[str, Any]] = []

    if isinstance(data, dict):
        raw_cols = data.get("columns", [])
        for c in raw_cols:
            if isinstance(c, dict):
                columns.append(c)
            elif isinstance(c, str):
                columns.append({"key": c, "label": c.replace("_", " ").title()})
        rows = data.get("rows", [])
    elif isinstance(data, list):
        if data and isinstance(data[0], dict):
            for k in data[0].keys():
                columns.append({"key": k, "label": k.replace("_", " ").title()})
            rows = data
        else:
            rows = []

    if columns:
        # Write CSV Header
        writer.writerow([c["label"] for c in columns])

        # Write CSV Rows
        for r in rows:
            row_vals = []
            for c in columns:
                raw_val = r.get(c["key"])
                row_vals.append(_format_cell_value(raw_val))
            writer.writerow(row_vals)
    elif isinstance(data, dict):
        # Fallback for key-value dictionary summary
        writer.writerow(["Key", "Value"])
        for k, v in data.items():
            if isinstance(v, dict):
                for sub_k, sub_v in v.items():
                    writer.writerow([f"{k} - {sub_k}", _format_cell_value(sub_v)])
            else:
                writer.writerow([k, _format_cell_value(v)])

    csv_content = output.getvalue()
    # Prepend UTF-8 BOM (\ufeff)
    return ("\ufeff" + csv_content).encode("utf-8")

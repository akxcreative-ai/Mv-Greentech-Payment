"""
Audit Logs API Router (Admin Only).

Provides compliance inspection and activity tracing across system operations:
- GET /api/audit-logs - Query immutable audit events with date, actor, and entity filtering
"""

from datetime import datetime
import logging
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import require_role
from app.models.audit_log import AuditEventType, AuditLog
from app.models.role import RoleEnum

logger = logging.getLogger("mv-payment-approval.api.audit_logs")

router = APIRouter(
    prefix="/audit-logs",
    tags=["Audit Logs"],
    dependencies=[Depends(require_role(RoleEnum.SUPER_ADMIN))],
)


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class AuditActorInfo(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str

    model_config = {"from_attributes": True}


class AuditLogEntryResponse(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    user: Optional[AuditActorInfo] = None
    event_type: AuditEventType
    entity_type: str
    entity_id: Optional[uuid.UUID] = None
    previous_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: List[AuditLogEntryResponse]
    total: int
    page: int
    page_size: int
    pages: int


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

@router.get(
    "",
    response_model=AuditLogListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Audit Logs",
    description="Returns a paginated list of immutable system audit trails with multi-attribute filtering.",
)
async def list_audit_logs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    event_type: Optional[AuditEventType] = Query(None, description="Filter by event type"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type (e.g. user, payment_request)"),
    user_id: Optional[uuid.UUID] = Query(None, description="Filter by actor user ID"),
    start_date: Optional[datetime] = Query(None, description="Start range timestamp"),
    end_date: Optional[datetime] = Query(None, description="End range timestamp"),
    db: AsyncSession = Depends(get_db),
):
    base_query = select(AuditLog).options(selectinload(AuditLog.user))

    if event_type:
        base_query = base_query.where(AuditLog.event_type == event_type)
    if entity_type:
        base_query = base_query.where(AuditLog.entity_type == entity_type.strip())
    if user_id:
        base_query = base_query.where(AuditLog.user_id == user_id)
    if start_date:
        base_query = base_query.where(AuditLog.created_at >= start_date)
    if end_date:
        base_query = base_query.where(AuditLog.created_at <= end_date)

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = base_query.order_by(desc(AuditLog.created_at)).offset(offset).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()

    pages = (total + page_size - 1) // page_size if total > 0 else 1

    return AuditLogListResponse(
        items=[AuditLogEntryResponse.model_validate(l) for l in logs],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )

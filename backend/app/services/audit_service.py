"""
Audit Logging Service for MV Payment Approval System.

Provides append-only compliance audit logging recording actors, events, state diffs,
and network metadata. Strictly append-only: no update or delete operations are permitted.
"""

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
import json
import logging
import math
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union
import uuid

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit_log import AuditEventType, AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)

T = TypeVar("T")


try:
    from app.schemas.common import PaginatedResponse
except ImportError:
    try:
        from app.schemas import PaginatedResponse
    except ImportError:

        class PaginatedResponse(BaseModel, Generic[T]):  # type: ignore
            items: List[T]
            total: int
            page: int
            page_size: int
            total_pages: int
            has_next: bool
            has_prev: bool

            class Config:
                arbitrary_types_allowed = True


def _json_serializable(val: Any) -> Any:
    """Recursively converts datatypes (UUID, datetime, Decimal, Enum) to JSON-safe primitives."""
    if val is None:
        return None
    if isinstance(val, (str, int, float, bool)):
        return val
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, Enum):
        return val.value
    if isinstance(val, dict):
        return {str(k): _json_serializable(v) for k, v in val.items()}
    if isinstance(val, (list, tuple, set)):
        return [_json_serializable(item) for item in val]
    if hasattr(val, "to_dict") and callable(val.to_dict):
        return _json_serializable(val.to_dict())
    if hasattr(val, "__dict__"):
        return _json_serializable({k: v for k, v in val.__dict__.items() if not k.startswith("_")})
    return str(val)


async def log_event(
    user_id: Optional[Union[uuid.UUID, str]],
    event_type: Union[AuditEventType, str],
    entity_type: str,
    entity_id: Optional[Union[uuid.UUID, str]],
    previous_value: Optional[Dict[str, Any]],
    new_value: Optional[Dict[str, Any]],
    ip: Optional[str],
    user_agent: Optional[str],
    db: AsyncSession,
) -> AuditLog:
    """
    Appends an immutable audit event to the ledger.
    Strictly append-only; update and delete operations are prohibited.

    Args:
        user_id: UUID or string of the actor initiating the action (or None for system/unauthenticated).
        event_type: AuditEventType enum or string representation.
        entity_type: Domain entity name (e.g. payment_request, user, vendor).
        entity_id: Target entity UUID or string.
        previous_value: Pre-mutation state snapshot.
        new_value: Post-mutation state snapshot.
        ip: Client IP address.
        user_agent: Client browser / device user-agent string.
        db: Active AsyncSession database session.

    Returns:
        The created AuditLog instance.
    """
    try:
        # Coerce user_id to UUID
        parsed_user_id: Optional[uuid.UUID] = None
        if user_id:
            parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

        # Coerce entity_id to UUID
        parsed_entity_id: Optional[uuid.UUID] = None
        if entity_id:
            parsed_entity_id = (
                entity_id if isinstance(entity_id, uuid.UUID) else uuid.UUID(str(entity_id))
            )

        # Coerce event_type to enum
        parsed_event_type: AuditEventType
        if isinstance(event_type, AuditEventType):
            parsed_event_type = event_type
        else:
            try:
                parsed_event_type = AuditEventType(str(event_type))
            except ValueError:
                # Fallback to generic system event or keep as is if enum has match
                parsed_event_type = AuditEventType.SYSTEM_EVENT

        # Sanitize JSON values
        safe_previous = _json_serializable(previous_value) if previous_value is not None else None
        safe_new = _json_serializable(new_value) if new_value is not None else None

        audit_entry = AuditLog(
            user_id=parsed_user_id,
            event_type=parsed_event_type,
            entity_type=str(entity_type).strip(),
            entity_id=parsed_entity_id,
            previous_value=safe_previous,
            new_value=safe_new,
            ip_address=str(ip)[:45] if ip else None,
            user_agent=str(user_agent)[:500] if user_agent else None,
        )

        db.add(audit_entry)
        await db.flush()
        return audit_entry

    except Exception as exc:
        logger.error(
            "Failed to log audit event [event=%s, entity=%s, user_id=%s]: %s",
            event_type,
            entity_type,
            user_id,
            exc,
            exc_info=True,
        )
        # Audit logging failure should not silently abort the primary transaction if avoidable,
        # but in strict compliance environments we re-raise or register warning
        raise


async def get_audit_logs(
    filters: Optional[Union[Dict[str, Any], Any]],
    pagination: Optional[Union[Dict[str, Any], Any]],
    db: AsyncSession,
) -> PaginatedResponse[AuditLog]:
    """
    Retrieves filtered and paginated audit log entries.
    Append-only compliance read model.

    Args:
        filters: Dictionary or schema containing query filters.
        pagination: Dictionary or schema containing page and page_size.
        db: Active AsyncSession database session.

    Returns:
        PaginatedResponse with audit logs and pagination metadata.
    """
    # Extract pagination parameters
    page = 1
    page_size = 20
    if pagination:
        if isinstance(pagination, dict):
            page = int(pagination.get("page", 1))
            page_size = int(pagination.get("page_size", pagination.get("limit", 20)))
        else:
            page = getattr(pagination, "page", 1)
            page_size = getattr(pagination, "page_size", getattr(pagination, "limit", 20))

    page = max(1, page)
    page_size = max(1, min(page_size, 100))

    # Base query
    query = select(AuditLog).options(selectinload(AuditLog.user))
    count_query = select(func.count()).select_from(AuditLog)

    # Apply filters
    if filters:
        filter_dict = (
            filters
            if isinstance(filters, dict)
            else (filters.model_dump() if hasattr(filters, "model_dump") else filters.__dict__)
        )

        # Filter by user_id
        if filter_dict.get("user_id"):
            u_id = filter_dict["user_id"]
            parsed_u_id = u_id if isinstance(u_id, uuid.UUID) else uuid.UUID(str(u_id))
            query = query.where(AuditLog.user_id == parsed_u_id)
            count_query = count_query.where(AuditLog.user_id == parsed_u_id)

        # Filter by event_type
        if filter_dict.get("event_type"):
            ev_type = filter_dict["event_type"]
            if not isinstance(ev_type, AuditEventType):
                try:
                    ev_type = AuditEventType(str(ev_type))
                except ValueError:
                    ev_type = None
            if ev_type:
                query = query.where(AuditLog.event_type == ev_type)
                count_query = count_query.where(AuditLog.event_type == ev_type)

        # Filter by entity_type
        if filter_dict.get("entity_type"):
            e_type = str(filter_dict["entity_type"]).strip()
            query = query.where(func.lower(AuditLog.entity_type) == e_type.lower())
            count_query = count_query.where(func.lower(AuditLog.entity_type) == e_type.lower())

        # Filter by entity_id
        if filter_dict.get("entity_id"):
            e_id = filter_dict["entity_id"]
            parsed_e_id = e_id if isinstance(e_id, uuid.UUID) else uuid.UUID(str(e_id))
            query = query.where(AuditLog.entity_id == parsed_e_id)
            count_query = count_query.where(AuditLog.entity_id == parsed_e_id)

        # Date range filters
        if filter_dict.get("start_date"):
            start_dt = filter_dict["start_date"]
            if isinstance(start_dt, str):
                start_dt = datetime.fromisoformat(start_dt)
            query = query.where(AuditLog.created_at >= start_dt)
            count_query = count_query.where(AuditLog.created_at >= start_dt)

        if filter_dict.get("end_date"):
            end_dt = filter_dict["end_date"]
            if isinstance(end_dt, str):
                end_dt = datetime.fromisoformat(end_dt)
            query = query.where(AuditLog.created_at <= end_dt)
            count_query = count_query.where(AuditLog.created_at <= end_dt)

        # Free text search across ip or user_agent
        if filter_dict.get("search"):
            search_pattern = f"%{str(filter_dict['search']).strip()}%"
            search_clause = (AuditLog.ip_address.ilike(search_pattern)) | (
                AuditLog.user_agent.ilike(search_pattern)
            )
            query = query.where(search_clause)
            count_query = count_query.where(search_clause)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar_one_or_none() or 0

    # Execute paginated select
    offset = (page - 1) * page_size
    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())

    total_pages = max(1, math.ceil(total / page_size)) if total > 0 else 1

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )

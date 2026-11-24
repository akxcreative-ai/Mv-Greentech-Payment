"""
Department Management Service for MV Payment Approval System.

Provides full CRUD operations for departments associated with companies and headed by users,
with comprehensive audit logging.
"""

import logging
import math
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union
import uuid

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit_log import AuditEventType
from app.models.company import Company
from app.models.department import Department
from app.models.user import User
from app.services.audit_service import log_event

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


def _extract_dict(data: Any) -> Dict[str, Any]:
    """Helper to convert Pydantic models or dicts to a standard dictionary."""
    if isinstance(data, dict):
        return data
    if hasattr(data, "model_dump"):
        return data.model_dump(exclude_unset=True)
    if hasattr(data, "dict"):
        return data.dict(exclude_unset=True)
    return dict(data)


async def create_department(
    data: Union[Dict[str, Any], Any],
    user_id: Optional[Union[uuid.UUID, str]],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Department:
    """
    Creates a new department within a company. Enforces unique (company_id, code).

    Args:
        data: Department creation parameters.
        user_id: Actor UUID creating the record.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The newly created Department model instance.

    Raises:
        HTTPException: 400 Bad Request if validation fails, 404 if company or head not found.
    """
    payload = _extract_dict(data)

    name = str(payload.get("name", "")).strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Department name is required.",
        )

    code = str(payload.get("code", "")).strip().upper()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Department code is required.",
        )

    raw_company_id = payload.get("company_id")
    if not raw_company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company ID is required.",
        )
    parsed_company_id = (
        raw_company_id if isinstance(raw_company_id, uuid.UUID) else uuid.UUID(str(raw_company_id))
    )

    company = await db.get(Company, parsed_company_id)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID '{parsed_company_id}' not found.",
        )

    # Check unique constraint (company_id, code)
    stmt_check = select(Department.id).where(
        Department.company_id == parsed_company_id,
        func.upper(Department.code) == code,
    )
    dup = await db.execute(stmt_check)
    if dup.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department with code '{code}' already exists in this company.",
        )

    parsed_head_id: Optional[uuid.UUID] = None
    if payload.get("head_id"):
        hid = payload["head_id"]
        parsed_head_id = hid if isinstance(hid, uuid.UUID) else uuid.UUID(str(hid))
        head_user = await db.get(User, parsed_head_id)
        if not head_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID '{parsed_head_id}' not found for department head.",
            )

    dept = Department(
        name=name,
        code=code,
        company_id=parsed_company_id,
        head_id=parsed_head_id,
        is_active=payload.get("is_active", True),
    )

    db.add(dept)
    await db.flush()

    await log_event(
        user_id=user_id,
        event_type=AuditEventType.DEPARTMENT_CREATED,
        entity_type="department",
        entity_id=dept.id,
        previous_value=None,
        new_value={"name": dept.name, "code": dept.code, "company_id": str(dept.company_id)},
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    # Load with relations
    stmt_load = (
        select(Department)
        .options(
            selectinload(Department.company),
            selectinload(Department.head),
        )
        .where(Department.id == dept.id)
    )
    res = await db.execute(stmt_load)
    return res.scalar_one()


async def update_department(
    department_id: Union[uuid.UUID, str],
    data: Union[Dict[str, Any], Any],
    user_id: Optional[Union[uuid.UUID, str]],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Department:
    """
    Updates an existing department's name, code, head, or active status.

    Args:
        department_id: Target department UUID.
        data: Updated fields dictionary or schema.
        user_id: Actor UUID performing update.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The updated Department model instance.

    Raises:
        HTTPException: 404 Not Found if department or head doesn't exist, 400 Bad Request on duplicate code.
    """
    parsed_id = department_id if isinstance(department_id, uuid.UUID) else uuid.UUID(str(department_id))
    payload = _extract_dict(data)

    stmt = (
        select(Department)
        .options(
            selectinload(Department.company),
            selectinload(Department.head),
        )
        .where(Department.id == parsed_id)
    )
    res = await db.execute(stmt)
    dept = res.scalar_one_or_none()

    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID '{parsed_id}' not found.",
        )

    previous_value = {
        "name": dept.name,
        "code": dept.code,
        "head_id": str(dept.head_id) if dept.head_id else None,
        "is_active": dept.is_active,
    }

    if "code" in payload and payload["code"]:
        new_code = str(payload["code"]).strip().upper()
        if new_code != dept.code:
            stmt_dup = select(Department.id).where(
                Department.company_id == dept.company_id,
                func.upper(Department.code) == new_code,
                Department.id != dept.id,
            )
            dup = await db.execute(stmt_dup)
            if dup.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Department code '{new_code}' already exists in this company.",
                )
            dept.code = new_code

    if "name" in payload and payload["name"]:
        dept.name = str(payload["name"]).strip()

    if "head_id" in payload:
        if payload["head_id"]:
            new_hid = (
                payload["head_id"]
                if isinstance(payload["head_id"], uuid.UUID)
                else uuid.UUID(str(payload["head_id"]))
            )
            head_user = await db.get(User, new_hid)
            if not head_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User with ID '{new_hid}' not found for department head.",
                )
            dept.head_id = new_hid
        else:
            dept.head_id = None

    if "is_active" in payload and payload["is_active"] is not None:
        dept.is_active = bool(payload["is_active"])

    new_value = {
        "name": dept.name,
        "code": dept.code,
        "head_id": str(dept.head_id) if dept.head_id else None,
        "is_active": dept.is_active,
    }

    await db.flush()

    await log_event(
        user_id=user_id,
        event_type=AuditEventType.DEPARTMENT_UPDATED,
        entity_type="department",
        entity_id=dept.id,
        previous_value=previous_value,
        new_value=new_value,
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return dept


async def get_department(
    department_id: Union[uuid.UUID, str],
    db: AsyncSession,
) -> Department:
    """
    Retrieves department with company and head details.

    Args:
        department_id: Target department UUID.
        db: Active AsyncSession database session.

    Returns:
        Department model instance.

    Raises:
        HTTPException: 404 Not Found if department does not exist.
    """
    parsed_id = department_id if isinstance(department_id, uuid.UUID) else uuid.UUID(str(department_id))

    stmt = (
        select(Department)
        .options(
            selectinload(Department.company),
            selectinload(Department.head),
        )
        .where(Department.id == parsed_id)
    )
    result = await db.execute(stmt)
    dept = result.scalar_one_or_none()

    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID '{parsed_id}' not found.",
        )

    return dept


async def list_departments(
    company_id: Optional[Union[uuid.UUID, str]] = None,
    filters: Optional[Union[Dict[str, Any], Any]] = None,
    pagination: Optional[Union[Dict[str, Any], Any]] = None,
    db: Optional[AsyncSession] = None,
) -> PaginatedResponse[Department]:
    """
    Lists departments optionally scoped to a company with pagination and search.

    Args:
        company_id: Optional Company UUID.
        filters: Optional filter parameters dictionary or schema.
        pagination: Optional pagination dictionary or schema.
        db: Active AsyncSession database session.

    Returns:
        PaginatedResponse of Department records.
    """
    if db is None:
        raise ValueError("Database session (db) is required.")

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

    query = (
        select(Department)
        .options(
            selectinload(Department.company),
            selectinload(Department.head),
        )
    )
    count_query = select(func.count()).select_from(Department)

    if company_id:
        parsed_cid = company_id if isinstance(company_id, uuid.UUID) else uuid.UUID(str(company_id))
        query = query.where(Department.company_id == parsed_cid)
        count_query = count_query.where(Department.company_id == parsed_cid)

    if filters:
        f = _extract_dict(filters)

        if not company_id and f.get("company_id"):
            cid = f["company_id"]
            parsed_cid = cid if isinstance(cid, uuid.UUID) else uuid.UUID(str(cid))
            query = query.where(Department.company_id == parsed_cid)
            count_query = count_query.where(Department.company_id == parsed_cid)

        if "is_active" in f and f["is_active"] is not None:
            active_bool = bool(f["is_active"])
            query = query.where(Department.is_active.is_(active_bool))
            count_query = count_query.where(Department.is_active.is_(active_bool))

        if f.get("search"):
            pat = f"%{str(f['search']).strip().lower()}%"
            search_clause = or_(
                func.lower(Department.name).ilike(pat),
                func.lower(Department.code).ilike(pat),
            )
            query = query.where(search_clause)
            count_query = count_query.where(search_clause)

    total_res = await db.execute(count_query)
    total = total_res.scalar_one_or_none() or 0

    offset = (page - 1) * page_size
    query = query.order_by(Department.name.asc()).offset(offset).limit(page_size)
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


async def delete_department(
    department_id: Union[uuid.UUID, str],
    user_id: Optional[Union[uuid.UUID, str]],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Department:
    """
    Deactivates a department record and logs the event.

    Args:
        department_id: Department UUID.
        user_id: Actor UUID performing deactivation.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The deactivated Department model instance.

    Raises:
        HTTPException: 404 Not Found if department doesn't exist.
    """
    parsed_id = department_id if isinstance(department_id, uuid.UUID) else uuid.UUID(str(department_id))

    dept = await db.get(Department, parsed_id)
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID '{parsed_id}' not found.",
        )

    previous_active = dept.is_active
    dept.is_active = False
    await db.flush()

    await log_event(
        user_id=user_id,
        event_type=AuditEventType.DEPARTMENT_UPDATED,
        entity_type="department",
        entity_id=dept.id,
        previous_value={"is_active": previous_active},
        new_value={"is_active": False, "action": "deactivated"},
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return dept

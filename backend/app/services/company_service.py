"""
Company Management Service for MV Payment Approval System.

Provides full CRUD operations for operating business entities in multi-company architecture
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


async def create_company(
    data: Union[Dict[str, Any], Any],
    user_id: Optional[Union[uuid.UUID, str]],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Company:
    """
    Creates a new company record with unique company code validation.

    Args:
        data: Company creation parameters.
        user_id: Actor UUID creating the record.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The newly created Company model instance.

    Raises:
        HTTPException: 400 Bad Request if code or name is missing/duplicated.
    """
    payload = _extract_dict(data)

    name = str(payload.get("name", "")).strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company name is required.",
        )

    code = str(payload.get("code", "")).strip().upper()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company code is required.",
        )

    # Check code uniqueness
    stmt_check = select(Company.id).where(func.upper(Company.code) == code)
    dup = await db.execute(stmt_check)
    if dup.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Company with code '{code}' already exists.",
        )

    company = Company(
        name=name,
        code=code,
        address=str(payload["address"]).strip() if payload.get("address") else None,
        phone=str(payload["phone"]).strip() if payload.get("phone") else None,
        email=str(payload["email"]).strip().lower() if payload.get("email") else None,
        gst_number=str(payload["gst_number"]).strip().upper() if payload.get("gst_number") else None,
        pan_number=str(payload["pan_number"]).strip().upper() if payload.get("pan_number") else None,
        logo_url=str(payload["logo_url"]).strip() if payload.get("logo_url") else None,
        is_active=payload.get("is_active", True),
        primary_color=str(payload.get("primary_color", "#1E40AF")),
        secondary_color=str(payload.get("secondary_color", "#3B82F6")),
    )

    db.add(company)
    await db.flush()

    await log_event(
        user_id=user_id,
        event_type=AuditEventType.COMPANY_CREATED,
        entity_type="company",
        entity_id=company.id,
        previous_value=None,
        new_value={"name": company.name, "code": company.code},
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return company


async def update_company(
    company_id: Union[uuid.UUID, str],
    data: Union[Dict[str, Any], Any],
    user_id: Optional[Union[uuid.UUID, str]],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Company:
    """
    Updates an existing company's master record with audit logging.

    Args:
        company_id: Target company UUID.
        data: Updated fields dictionary or schema.
        user_id: Actor UUID performing update.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The updated Company model instance.

    Raises:
        HTTPException: 404 Not Found if company doesn't exist, 400 Bad Request if code duplicate.
    """
    parsed_id = company_id if isinstance(company_id, uuid.UUID) else uuid.UUID(str(company_id))
    payload = _extract_dict(data)

    company = await db.get(Company, parsed_id)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID '{parsed_id}' not found.",
        )

    previous_value = {
        "name": company.name,
        "code": company.code,
        "gst_number": company.gst_number,
        "is_active": company.is_active,
    }

    if "code" in payload and payload["code"]:
        new_code = str(payload["code"]).strip().upper()
        if new_code != company.code:
            stmt_dup = select(Company.id).where(
                func.upper(Company.code) == new_code,
                Company.id != company.id,
            )
            dup = await db.execute(stmt_dup)
            if dup.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Company code '{new_code}' is already used by another company.",
                )
            company.code = new_code

    if "name" in payload and payload["name"]:
        company.name = str(payload["name"]).strip()

    if "address" in payload:
        company.address = str(payload["address"]).strip() if payload["address"] else None

    if "phone" in payload:
        company.phone = str(payload["phone"]).strip() if payload["phone"] else None

    if "email" in payload:
        company.email = str(payload["email"]).strip().lower() if payload["email"] else None

    if "gst_number" in payload:
        company.gst_number = (
            str(payload["gst_number"]).strip().upper() if payload["gst_number"] else None
        )

    if "pan_number" in payload:
        company.pan_number = (
            str(payload["pan_number"]).strip().upper() if payload["pan_number"] else None
        )

    if "logo_url" in payload:
        company.logo_url = str(payload["logo_url"]).strip() if payload["logo_url"] else None

    if "is_active" in payload and payload["is_active"] is not None:
        company.is_active = bool(payload["is_active"])

    if "primary_color" in payload and payload["primary_color"]:
        company.primary_color = str(payload["primary_color"]).strip()

    if "secondary_color" in payload and payload["secondary_color"]:
        company.secondary_color = str(payload["secondary_color"]).strip()

    new_value = {
        "name": company.name,
        "code": company.code,
        "gst_number": company.gst_number,
        "is_active": company.is_active,
    }

    await db.flush()

    await log_event(
        user_id=user_id,
        event_type=AuditEventType.COMPANY_UPDATED,
        entity_type="company",
        entity_id=company.id,
        previous_value=previous_value,
        new_value=new_value,
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return company


async def get_company(
    company_id: Union[uuid.UUID, str],
    db: AsyncSession,
) -> Company:
    """
    Retrieves a company by ID with its departments.

    Args:
        company_id: Company UUID.
        db: Active AsyncSession database session.

    Returns:
        Company model instance.

    Raises:
        HTTPException: 404 Not Found if company does not exist.
    """
    parsed_id = company_id if isinstance(company_id, uuid.UUID) else uuid.UUID(str(company_id))

    stmt = (
        select(Company)
        .options(selectinload(Company.departments))
        .where(Company.id == parsed_id)
    )
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID '{parsed_id}' not found.",
        )

    return company


async def list_companies(
    filters: Optional[Union[Dict[str, Any], Any]],
    pagination: Optional[Union[Dict[str, Any], Any]],
    db: AsyncSession,
) -> PaginatedResponse[Company]:
    """
    Lists companies with optional active filtering and pagination.

    Args:
        filters: Filter criteria dictionary or schema.
        pagination: Pagination dictionary or schema.
        db: Active AsyncSession database session.

    Returns:
        PaginatedResponse of Company records.
    """
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

    query = select(Company).options(selectinload(Company.departments))
    count_query = select(func.count()).select_from(Company)

    if filters:
        f = _extract_dict(filters)

        if "is_active" in f and f["is_active"] is not None:
            active_bool = bool(f["is_active"])
            query = query.where(Company.is_active.is_(active_bool))
            count_query = count_query.where(Company.is_active.is_(active_bool))

        if f.get("search"):
            pat = f"%{str(f['search']).strip().lower()}%"
            search_clause = or_(
                func.lower(Company.name).ilike(pat),
                func.lower(Company.code).ilike(pat),
                func.lower(Company.gst_number).ilike(pat),
            )
            query = query.where(search_clause)
            count_query = count_query.where(search_clause)

    total_res = await db.execute(count_query)
    total = total_res.scalar_one_or_none() or 0

    offset = (page - 1) * page_size
    query = query.order_by(Company.name.asc()).offset(offset).limit(page_size)
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


async def delete_company(
    company_id: Union[uuid.UUID, str],
    user_id: Optional[Union[uuid.UUID, str]],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Company:
    """
    Deactivates a company record and logs the event.

    Args:
        company_id: Company UUID.
        user_id: Actor UUID performing deactivation.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The deactivated Company model instance.

    Raises:
        HTTPException: 404 Not Found if company doesn't exist.
    """
    parsed_id = company_id if isinstance(company_id, uuid.UUID) else uuid.UUID(str(company_id))

    company = await db.get(Company, parsed_id)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID '{parsed_id}' not found.",
        )

    previous_active = company.is_active
    company.is_active = False
    await db.flush()

    await log_event(
        user_id=user_id,
        event_type=AuditEventType.COMPANY_UPDATED,
        entity_type="company",
        entity_id=company.id,
        previous_value={"is_active": previous_active},
        new_value={"is_active": False, "action": "deactivated"},
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return company

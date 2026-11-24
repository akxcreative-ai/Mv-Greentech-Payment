"""
Vendor Management Service for MV Payment Approval System.

Provides master vendor record CRUD operations with strict audit logging
and role-based bank detail masking to safeguard sensitive disbursement credentials.
"""

import copy
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
from app.models.role import RoleEnum
from app.models.user import User
from app.models.vendor import Vendor
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


def has_finance_access(user: Optional[Union[User, Dict[str, Any], Any]]) -> bool:
    """
    Checks if a user has authorized finance privileges to view unmasked banking details.
    Authorized roles: Super Admin, Director, Accountant.
    """
    if not user:
        return False

    role_name = ""
    if isinstance(user, dict):
        role_name = str(user.get("role") or user.get("role_name") or "").lower()
    elif hasattr(user, "role") and user.role:
        role_name = str(getattr(user.role, "name", "")).lower()
    elif hasattr(user, "role_name"):
        role_name = str(getattr(user, "role_name", "")).lower()

    authorized = {
        RoleEnum.SUPER_ADMIN.value.lower(),
        RoleEnum.DIRECTOR.value.lower(),
        RoleEnum.ACCOUNTANT.value.lower(),
        "super_admin",
        "director",
        "accountant",
        "finance",
    }
    return role_name in authorized


def mask_vendor_bank_details(vendor: Vendor) -> Vendor:
    """
    Safely creates a detached copy of Vendor with masked bank account and IFSC details.
    Prevents leaking confidential banking information to non-finance users while
    ensuring SQLAlchemy session state is not corrupted.
    """
    masked_vendor = copy.copy(vendor)
    # Mask account number: preserve last 4 digits only
    if vendor.bank_account_number:
        acct = str(vendor.bank_account_number).strip()
        if len(acct) > 4:
            masked_vendor.bank_account_number = f"{'*' * (len(acct) - 4)}{acct[-4:]}"
        else:
            masked_vendor.bank_account_number = "****"

    if vendor.bank_ifsc:
        ifsc = str(vendor.bank_ifsc).strip()
        if len(ifsc) > 3:
            masked_vendor.bank_ifsc = f"{ifsc[:2]}*****{ifsc[-2:]}"
        else:
            masked_vendor.bank_ifsc = "*****"

    return masked_vendor


async def create_vendor(
    data: Union[Dict[str, Any], Any],
    user_id: Optional[Union[uuid.UUID, str]],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Vendor:
    """
    Registers a new vendor / supplier record within a company. Enforces unique (company_id, code).

    Args:
        data: Vendor creation parameters.
        user_id: Actor UUID creating the vendor.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The newly created Vendor model instance.

    Raises:
        HTTPException: 400 Bad Request if validation fails, 404 if company does not exist.
    """
    payload = _extract_dict(data)

    name = str(payload.get("name", "")).strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vendor name is required.",
        )

    code = str(payload.get("code", "")).strip().upper()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vendor code is required.",
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
    stmt_check = select(Vendor.id).where(
        Vendor.company_id == parsed_company_id,
        func.upper(Vendor.code) == code,
        Vendor.is_deleted.is_(False),
    )
    dup = await db.execute(stmt_check)
    if dup.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vendor with code '{code}' already exists in this company.",
        )

    vendor = Vendor(
        name=name,
        code=code,
        company_id=parsed_company_id,
        contact_person=str(payload["contact_person"]).strip() if payload.get("contact_person") else None,
        email=str(payload["email"]).strip().lower() if payload.get("email") else None,
        phone=str(payload["phone"]).strip() if payload.get("phone") else None,
        address=str(payload["address"]).strip() if payload.get("address") else None,
        gst_number=str(payload["gst_number"]).strip().upper() if payload.get("gst_number") else None,
        pan_number=str(payload["pan_number"]).strip().upper() if payload.get("pan_number") else None,
        bank_name=str(payload["bank_name"]).strip() if payload.get("bank_name") else None,
        bank_account_number=str(payload["bank_account_number"]).strip()
        if payload.get("bank_account_number")
        else None,
        bank_ifsc=str(payload["bank_ifsc"]).strip().upper() if payload.get("bank_ifsc") else None,
        bank_branch=str(payload["bank_branch"]).strip() if payload.get("bank_branch") else None,
        is_active=payload.get("is_active", True),
    )

    db.add(vendor)
    await db.flush()

    await log_event(
        user_id=user_id,
        event_type=AuditEventType.VENDOR_CREATED,
        entity_type="vendor",
        entity_id=vendor.id,
        previous_value=None,
        new_value={
            "name": vendor.name,
            "code": vendor.code,
            "company_id": str(vendor.company_id),
            "gst_number": vendor.gst_number,
        },
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return vendor


async def update_vendor(
    vendor_id: Union[uuid.UUID, str],
    data: Union[Dict[str, Any], Any],
    user_id: Optional[Union[uuid.UUID, str]],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Vendor:
    """
    Updates an existing vendor's master records and banking details with audit logging.

    Args:
        vendor_id: Target vendor UUID.
        data: Updated fields dictionary or schema.
        user_id: Actor UUID performing update.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The updated Vendor model instance.

    Raises:
        HTTPException: 404 Not Found if vendor doesn't exist, 400 Bad Request on code collision.
    """
    parsed_id = vendor_id if isinstance(vendor_id, uuid.UUID) else uuid.UUID(str(vendor_id))
    payload = _extract_dict(data)

    stmt = select(Vendor).where(Vendor.id == parsed_id, Vendor.is_deleted.is_(False))
    res = await db.execute(stmt)
    vendor = res.scalar_one_or_none()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor with ID '{parsed_id}' not found.",
        )

    previous_value = {
        "name": vendor.name,
        "code": vendor.code,
        "email": vendor.email,
        "gst_number": vendor.gst_number,
        "bank_account_number": vendor.bank_account_number,
        "is_active": vendor.is_active,
    }

    if "code" in payload and payload["code"]:
        new_code = str(payload["code"]).strip().upper()
        if new_code != vendor.code:
            stmt_dup = select(Vendor.id).where(
                Vendor.company_id == vendor.company_id,
                func.upper(Vendor.code) == new_code,
                Vendor.id != vendor.id,
                Vendor.is_deleted.is_(False),
            )
            dup = await db.execute(stmt_dup)
            if dup.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Vendor code '{new_code}' already exists in this company.",
                )
            vendor.code = new_code

    if "name" in payload and payload["name"]:
        vendor.name = str(payload["name"]).strip()

    if "contact_person" in payload:
        vendor.contact_person = (
            str(payload["contact_person"]).strip() if payload["contact_person"] else None
        )

    if "email" in payload:
        vendor.email = str(payload["email"]).strip().lower() if payload["email"] else None

    if "phone" in payload:
        vendor.phone = str(payload["phone"]).strip() if payload["phone"] else None

    if "address" in payload:
        vendor.address = str(payload["address"]).strip() if payload["address"] else None

    if "gst_number" in payload:
        vendor.gst_number = (
            str(payload["gst_number"]).strip().upper() if payload["gst_number"] else None
        )

    if "pan_number" in payload:
        vendor.pan_number = (
            str(payload["pan_number"]).strip().upper() if payload["pan_number"] else None
        )

    if "bank_name" in payload:
        vendor.bank_name = str(payload["bank_name"]).strip() if payload["bank_name"] else None

    if "bank_account_number" in payload:
        vendor.bank_account_number = (
            str(payload["bank_account_number"]).strip() if payload["bank_account_number"] else None
        )

    if "bank_ifsc" in payload:
        vendor.bank_ifsc = (
            str(payload["bank_ifsc"]).strip().upper() if payload["bank_ifsc"] else None
        )

    if "bank_branch" in payload:
        vendor.bank_branch = str(payload["bank_branch"]).strip() if payload["bank_branch"] else None

    if "is_active" in payload and payload["is_active"] is not None:
        vendor.is_active = bool(payload["is_active"])

    new_value = {
        "name": vendor.name,
        "code": vendor.code,
        "email": vendor.email,
        "gst_number": vendor.gst_number,
        "bank_account_number": vendor.bank_account_number,
        "is_active": vendor.is_active,
    }

    await db.flush()

    await log_event(
        user_id=user_id,
        event_type=AuditEventType.VENDOR_UPDATED,
        entity_type="vendor",
        entity_id=vendor.id,
        previous_value=previous_value,
        new_value=new_value,
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return vendor


async def get_vendor(
    vendor_id: Union[uuid.UUID, str],
    user: Optional[Union[User, Dict[str, Any], Any]],
    db: AsyncSession,
) -> Vendor:
    """
    Retrieves vendor master record.
    Enforces bank detail access control: non-finance users receive masked bank details.

    Args:
        vendor_id: Target vendor UUID.
        user: Requesting user object for authorization check.
        db: Active AsyncSession database session.

    Returns:
        Vendor model instance (with masked banking if unauthorized).

    Raises:
        HTTPException: 404 Not Found if vendor does not exist or is deleted.
    """
    parsed_id = vendor_id if isinstance(vendor_id, uuid.UUID) else uuid.UUID(str(vendor_id))

    stmt = (
        select(Vendor)
        .options(selectinload(Vendor.company))
        .where(Vendor.id == parsed_id, Vendor.is_deleted.is_(False))
    )
    result = await db.execute(stmt)
    vendor = result.scalar_one_or_none()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor with ID '{parsed_id}' not found.",
        )

    # Bank detail access control
    if not has_finance_access(user):
        return mask_vendor_bank_details(vendor)

    return vendor


async def list_vendors(
    filters: Optional[Union[Dict[str, Any], Any]],
    pagination: Optional[Union[Dict[str, Any], Any]],
    user: Optional[Union[User, Dict[str, Any], Any]],
    db: AsyncSession,
) -> PaginatedResponse[Vendor]:
    """
    Lists vendors with filtering, search, pagination, and banking detail masking for non-finance users.

    Args:
        filters: Filter criteria dictionary or schema.
        pagination: Pagination dictionary or schema.
        user: Requesting user object for permission enforcement.
        db: Active AsyncSession database session.

    Returns:
        PaginatedResponse containing Vendor instances.
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

    query = (
        select(Vendor)
        .options(selectinload(Vendor.company))
        .where(Vendor.is_deleted.is_(False))
    )
    count_query = select(func.count()).select_from(Vendor).where(Vendor.is_deleted.is_(False))

    if filters:
        f = _extract_dict(filters)

        if f.get("company_id"):
            cid = f["company_id"]
            parsed_cid = cid if isinstance(cid, uuid.UUID) else uuid.UUID(str(cid))
            query = query.where(Vendor.company_id == parsed_cid)
            count_query = count_query.where(Vendor.company_id == parsed_cid)

        if "is_active" in f and f["is_active"] is not None:
            active_bool = bool(f["is_active"])
            query = query.where(Vendor.is_active.is_(active_bool))
            count_query = count_query.where(Vendor.is_active.is_(active_bool))

        if f.get("search"):
            pat = f"%{str(f['search']).strip().lower()}%"
            search_clause = or_(
                func.lower(Vendor.name).ilike(pat),
                func.lower(Vendor.code).ilike(pat),
                func.lower(Vendor.gst_number).ilike(pat),
                func.lower(Vendor.pan_number).ilike(pat),
                func.lower(Vendor.contact_person).ilike(pat),
            )
            query = query.where(search_clause)
            count_query = count_query.where(search_clause)

    total_res = await db.execute(count_query)
    total = total_res.scalar_one_or_none() or 0

    offset = (page - 1) * page_size
    query = query.order_by(Vendor.name.asc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    raw_items = list(result.scalars().all())

    # Apply banking details access control
    allow_finance = has_finance_access(user)
    items = raw_items if allow_finance else [mask_vendor_bank_details(v) for v in raw_items]

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


async def delete_vendor(
    vendor_id: Union[uuid.UUID, str],
    user_id: Optional[Union[uuid.UUID, str]],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Vendor:
    """
    Soft-deletes a vendor master record and logs the event.

    Args:
        vendor_id: Vendor UUID.
        user_id: Actor UUID performing deletion.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The deleted Vendor model instance.

    Raises:
        HTTPException: 404 Not Found if vendor doesn't exist.
    """
    parsed_id = vendor_id if isinstance(vendor_id, uuid.UUID) else uuid.UUID(str(vendor_id))

    stmt = select(Vendor).where(Vendor.id == parsed_id, Vendor.is_deleted.is_(False))
    res = await db.execute(stmt)
    vendor = res.scalar_one_or_none()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor with ID '{parsed_id}' not found.",
        )

    vendor.soft_delete()
    await db.flush()

    await log_event(
        user_id=user_id,
        event_type=AuditEventType.VENDOR_DELETED,
        entity_type="vendor",
        entity_id=vendor.id,
        previous_value={"is_deleted": False},
        new_value={"is_deleted": True, "action": "soft_deleted"},
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return vendor

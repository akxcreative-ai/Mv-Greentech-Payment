"""
User Management Service for MV Payment Approval System.

Handles user provisioning, profile modification, deactivation, password changes,
role/department associations, and approver directory lookups.
"""

from datetime import datetime, timezone
import logging
import math
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union
import uuid

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit_log import AuditEventType
from app.models.company import Company
from app.models.department import Department
from app.models.role import Role, RoleEnum
from app.models.session import UserSession
from app.models.user import User
from app.services.audit_service import log_event
from app.utils.security import hash_password, verify_password

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


async def create_user(
    data: Union[Dict[str, Any], Any],
    db: AsyncSession,
    actor_id: Optional[Union[uuid.UUID, str]] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> User:
    """
    Creates a new user record with Argon2id hashed password and strict email uniqueness validation.

    Args:
        data: User data dict or schema containing email, password, first_name, last_name, role_id, etc.
        db: Active AsyncSession database session.
        actor_id: Optional UUID of administrator creating the user.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The newly created User model instance.

    Raises:
        HTTPException: 400 Bad Request if email already exists or required fields are missing.
    """
    payload = _extract_dict(data)

    raw_email = payload.get("email")
    if not raw_email or not str(raw_email).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is required.",
        )
    clean_email = str(raw_email).strip().lower()

    # 1. Validate email uniqueness
    stmt_check = select(User.id).where(
        func.lower(User.email) == clean_email,
        User.is_deleted.is_(False),
    )
    result_check = await db.execute(stmt_check)
    if result_check.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A user with email address '{clean_email}' already exists.",
        )

    # 2. Validate password
    raw_password = payload.get("password")
    if not raw_password or len(str(raw_password)) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be provided and contain at least 8 characters.",
        )
    hashed_pwd = hash_password(str(raw_password))

    # 3. Validate role_id
    raw_role_id = payload.get("role_id")
    if not raw_role_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role ID is required.",
        )
    parsed_role_id = raw_role_id if isinstance(raw_role_id, uuid.UUID) else uuid.UUID(str(raw_role_id))
    role = await db.get(Role, parsed_role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with ID '{parsed_role_id}' does not exist.",
        )

    # 4. Optional company & department validation
    parsed_company_id: Optional[uuid.UUID] = None
    if payload.get("company_id"):
        cid = payload["company_id"]
        parsed_company_id = cid if isinstance(cid, uuid.UUID) else uuid.UUID(str(cid))
        company = await db.get(Company, parsed_company_id)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Company with ID '{parsed_company_id}' does not exist.",
            )

    parsed_dept_id: Optional[uuid.UUID] = None
    if payload.get("department_id"):
        did = payload["department_id"]
        parsed_dept_id = did if isinstance(did, uuid.UUID) else uuid.UUID(str(did))
        dept = await db.get(Department, parsed_dept_id)
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Department with ID '{parsed_dept_id}' does not exist.",
            )

    user = User(
        email=clean_email,
        password_hash=hashed_pwd,
        first_name=str(payload.get("first_name", "")).strip(),
        last_name=str(payload.get("last_name", "")).strip(),
        role_id=parsed_role_id,
        company_id=parsed_company_id,
        department_id=parsed_dept_id,
        is_active=payload.get("is_active", True),
        email_verified=payload.get("email_verified", False),
        phone=str(payload["phone"]).strip() if payload.get("phone") else None,
        avatar_url=str(payload["avatar_url"]).strip() if payload.get("avatar_url") else None,
    )

    db.add(user)
    await db.flush()

    # Audit log
    await log_event(
        user_id=actor_id,
        event_type=AuditEventType.USER_CREATED,
        entity_type="user",
        entity_id=user.id,
        previous_value=None,
        new_value={
            "email": user.email,
            "role_id": str(user.role_id),
            "company_id": str(user.company_id) if user.company_id else None,
            "department_id": str(user.department_id) if user.department_id else None,
        },
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    # Refresh user with relations
    stmt_load = (
        select(User)
        .options(
            selectinload(User.role),
            selectinload(User.company),
            selectinload(User.department),
        )
        .where(User.id == user.id)
    )
    res = await db.execute(stmt_load)
    return res.scalar_one()


async def update_user(
    user_id: Union[uuid.UUID, str],
    data: Union[Dict[str, Any], Any],
    db: AsyncSession,
    actor_id: Optional[Union[uuid.UUID, str]] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> User:
    """
    Updates profile, organization links, role, or active status of an existing user.

    Args:
        user_id: Target user UUID.
        data: Updated fields dict or schema.
        db: Active AsyncSession database session.
        actor_id: UUID of user performing update.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The updated User model instance.

    Raises:
        HTTPException: 404 Not Found if user doesn't exist, 400 Bad Request if email in conflict.
    """
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
    payload = _extract_dict(data)

    stmt = (
        select(User)
        .options(
            selectinload(User.role),
            selectinload(User.company),
            selectinload(User.department),
        )
        .where(User.id == parsed_user_id, User.is_deleted.is_(False))
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{parsed_user_id}' not found.",
        )

    previous_state: Dict[str, Any] = {
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role_id": str(user.role_id),
        "company_id": str(user.company_id) if user.company_id else None,
        "department_id": str(user.department_id) if user.department_id else None,
        "is_active": user.is_active,
    }

    # Email update with uniqueness validation
    if "email" in payload and payload["email"]:
        new_email = str(payload["email"]).strip().lower()
        if new_email != user.email:
            stmt_dup = select(User.id).where(
                func.lower(User.email) == new_email,
                User.id != user.id,
                User.is_deleted.is_(False),
            )
            dup_res = await db.execute(stmt_dup)
            if dup_res.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email address '{new_email}' is already registered to another user.",
                )
            user.email = new_email

    if "first_name" in payload and payload["first_name"] is not None:
        user.first_name = str(payload["first_name"]).strip()

    if "last_name" in payload and payload["last_name"] is not None:
        user.last_name = str(payload["last_name"]).strip()

    if "phone" in payload:
        user.phone = str(payload["phone"]).strip() if payload["phone"] else None

    if "avatar_url" in payload:
        user.avatar_url = str(payload["avatar_url"]).strip() if payload["avatar_url"] else None

    if "is_active" in payload and payload["is_active"] is not None:
        user.is_active = bool(payload["is_active"])

    if "role_id" in payload and payload["role_id"]:
        new_role_id = (
            payload["role_id"]
            if isinstance(payload["role_id"], uuid.UUID)
            else uuid.UUID(str(payload["role_id"]))
        )
        role = await db.get(Role, new_role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role with ID '{new_role_id}' not found.",
            )
        user.role_id = new_role_id

    if "company_id" in payload:
        if payload["company_id"]:
            new_cid = (
                payload["company_id"]
                if isinstance(payload["company_id"], uuid.UUID)
                else uuid.UUID(str(payload["company_id"]))
            )
            user.company_id = new_cid
        else:
            user.company_id = None

    if "department_id" in payload:
        if payload["department_id"]:
            new_did = (
                payload["department_id"]
                if isinstance(payload["department_id"], uuid.UUID)
                else uuid.UUID(str(payload["department_id"]))
            )
            user.department_id = new_did
        else:
            user.department_id = None

    if "password" in payload and payload["password"]:
        if len(str(payload["password"])) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters in length.",
            )
        user.password_hash = hash_password(str(payload["password"]))

    new_state: Dict[str, Any] = {
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role_id": str(user.role_id),
        "company_id": str(user.company_id) if user.company_id else None,
        "department_id": str(user.department_id) if user.department_id else None,
        "is_active": user.is_active,
    }

    await db.flush()

    await log_event(
        user_id=actor_id,
        event_type=AuditEventType.USER_UPDATED,
        entity_type="user",
        entity_id=user.id,
        previous_value=previous_state,
        new_value=new_state,
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return user


async def deactivate_user(
    user_id: Union[uuid.UUID, str],
    db: AsyncSession,
    actor_id: Optional[Union[uuid.UUID, str]] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> User:
    """
    Deactivates a user account, invalidates active sessions, and logs the event.

    Args:
        user_id: Target user UUID.
        db: Active AsyncSession database session.
        actor_id: Actor UUID performing deactivation.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The deactivated User model instance.

    Raises:
        HTTPException: 404 Not Found if user doesn't exist.
    """
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

    stmt = select(User).where(User.id == parsed_user_id, User.is_deleted.is_(False))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{parsed_user_id}' not found.",
        )

    previous_active = user.is_active
    user.is_active = False

    # Invalidate all active sessions
    stmt_sessions = (
        update(UserSession)
        .where(UserSession.user_id == user.id)
        .values(is_active=False)
    )
    await db.execute(stmt_sessions)
    await db.flush()

    await log_event(
        user_id=actor_id,
        event_type=AuditEventType.USER_DELETED,
        entity_type="user",
        entity_id=user.id,
        previous_value={"is_active": previous_active},
        new_value={"is_active": False, "action": "deactivated"},
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return user


async def get_user(
    user_id: Union[uuid.UUID, str],
    db: AsyncSession,
) -> User:
    """
    Retrieves full user entity with related role, company, and department.

    Args:
        user_id: Target user UUID.
        db: Active AsyncSession database session.

    Returns:
        User model instance.

    Raises:
        HTTPException: 404 Not Found if user does not exist or is deleted.
    """
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

    stmt = (
        select(User)
        .options(
            selectinload(User.role),
            selectinload(User.company),
            selectinload(User.department),
        )
        .where(User.id == parsed_user_id, User.is_deleted.is_(False))
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{parsed_user_id}' not found.",
        )

    return user


async def list_users(
    filters: Optional[Union[Dict[str, Any], Any]],
    pagination: Optional[Union[Dict[str, Any], Any]],
    db: AsyncSession,
) -> PaginatedResponse[User]:
    """
    Lists users with filtering (company, department, role, search) and pagination.

    Args:
        filters: Filter criteria dictionary or schema.
        pagination: Pagination dictionary or schema.
        db: Active AsyncSession database session.

    Returns:
        PaginatedResponse containing User instances.
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
        select(User)
        .options(
            selectinload(User.role),
            selectinload(User.company),
            selectinload(User.department),
        )
        .where(User.is_deleted.is_(False))
    )
    count_query = select(func.count()).select_from(User).where(User.is_deleted.is_(False))

    if filters:
        f = _extract_dict(filters)

        if f.get("company_id"):
            cid = f["company_id"]
            parsed_cid = cid if isinstance(cid, uuid.UUID) else uuid.UUID(str(cid))
            query = query.where(User.company_id == parsed_cid)
            count_query = count_query.where(User.company_id == parsed_cid)

        if f.get("department_id"):
            did = f["department_id"]
            parsed_did = did if isinstance(did, uuid.UUID) else uuid.UUID(str(did))
            query = query.where(User.department_id == parsed_did)
            count_query = count_query.where(User.department_id == parsed_did)

        if f.get("role_id"):
            rid = f["role_id"]
            parsed_rid = rid if isinstance(rid, uuid.UUID) else uuid.UUID(str(rid))
            query = query.where(User.role_id == parsed_rid)
            count_query = count_query.where(User.role_id == parsed_rid)

        if f.get("role_name"):
            r_name = str(f["role_name"]).strip().lower()
            query = query.join(User.role).where(func.lower(Role.name) == r_name)
            count_query = count_query.join(User.role).where(func.lower(Role.name) == r_name)

        if "is_active" in f and f["is_active"] is not None:
            active_bool = bool(f["is_active"])
            query = query.where(User.is_active.is_(active_bool))
            count_query = count_query.where(User.is_active.is_(active_bool))

        if f.get("search"):
            pat = f"%{str(f['search']).strip().lower()}%"
            search_clause = or_(
                func.lower(User.first_name).ilike(pat),
                func.lower(User.last_name).ilike(pat),
                func.lower(User.email).ilike(pat),
            )
            query = query.where(search_clause)
            count_query = count_query.where(search_clause)

    total_res = await db.execute(count_query)
    total = total_res.scalar_one_or_none() or 0

    offset = (page - 1) * page_size
    query = query.order_by(User.created_at.desc()).offset(offset).limit(page_size)
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


async def change_password(
    user_id: Union[uuid.UUID, str],
    current: str,
    new: str,
    db: AsyncSession,
) -> bool:
    """
    Validates current password and sets a new Argon2id hashed password.

    Args:
        user_id: Target user UUID.
        current: Current plain-text password.
        new: New plain-text password.
        db: Active AsyncSession database session.

    Returns:
        True upon successful password update.

    Raises:
        HTTPException: 400 Bad Request if current password is wrong or new password is too weak.
    """
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

    stmt = select(User).where(User.id == parsed_user_id, User.is_deleted.is_(False))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # Verify current password
    if not verify_password(current, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password does not match.",
        )

    # Validate new password
    if not new or len(new) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long.",
        )

    user.password_hash = hash_password(new)

    # Invalidate active sessions
    stmt_sessions = (
        update(UserSession)
        .where(UserSession.user_id == user.id)
        .values(is_active=False)
    )
    await db.execute(stmt_sessions)
    await db.flush()

    await log_event(
        user_id=user.id,
        event_type=AuditEventType.PASSWORD_CHANGED,
        entity_type="user",
        entity_id=user.id,
        previous_value=None,
        new_value={"action": "password_changed"},
        ip=None,
        user_agent=None,
        db=db,
    )

    return True


async def get_approvers(
    company_id: Optional[Union[uuid.UUID, str]],
    db: AsyncSession,
) -> List[User]:
    """
    Returns a list of active users capable of approving payment requests within a company.
    Includes directors, department heads, accountants, and super admins.

    Args:
        company_id: Target company UUID (optional; if None, returns across all).
        db: Active AsyncSession database session.

    Returns:
        List of User ORM model instances.
    """
    approver_roles = [
        RoleEnum.DIRECTOR.value,
        RoleEnum.DEPARTMENT_HEAD.value,
        RoleEnum.ACCOUNTANT.value,
        RoleEnum.SUPER_ADMIN.value,
    ]

    query = (
        select(User)
        .join(User.role)
        .options(
            selectinload(User.role),
            selectinload(User.company),
            selectinload(User.department),
        )
        .where(
            User.is_active.is_(True),
            User.is_deleted.is_(False),
            or_(
                Role.name.in_(approver_roles),
                func.lower(Role.name).in_(["director", "department_head", "accountant", "super_admin"]),
            ),
        )
    )

    if company_id:
        parsed_cid = company_id if isinstance(company_id, uuid.UUID) else uuid.UUID(str(company_id))
        # Super admins can approve across companies, company specific approvers belong to company
        query = query.where(
            or_(
                User.company_id == parsed_cid,
                Role.name == RoleEnum.SUPER_ADMIN.value,
            )
        )

    query = query.order_by(User.first_name.asc(), User.last_name.asc())
    result = await db.execute(query)
    return list(result.scalars().all())

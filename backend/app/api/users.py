"""
User Management API Router (Admin Only).

Implements:
- GET /api/users - List users with pagination and filtering
- POST /api/users - Create new user account
- GET /api/users/approvers - List users eligible for approval assignment
- GET /api/users/{id} - Retrieve specific user details
- PUT /api/users/{id} - Update user attributes, role, or status
- DELETE /api/users/{id} - Soft-delete / deactivate user account
"""

from datetime import datetime
import logging
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.middleware.rate_limit import get_client_ip
from app.models.audit_log import AuditEventType, AuditLog
from app.models.role import Role, RoleEnum
from app.models.user import User
from app.utils.security import hash_password

logger = logging.getLogger("mv-payment-approval.api.users")

router = APIRouter(
    prefix="/users",
    tags=["Users"],
    dependencies=[Depends(require_role(RoleEnum.SUPER_ADMIN))],
)


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class RoleNestedResponse(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str
    permissions: Dict[str, Any]

    model_config = {"from_attributes": True}


class UserDetailResponse(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    full_name: str
    role_id: uuid.UUID
    role: Optional[RoleNestedResponse] = None
    department_id: Optional[uuid.UUID] = None
    company_id: Optional[uuid.UUID] = None
    is_active: bool
    is_locked: bool
    email_verified: bool
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    items: List[UserDetailResponse]
    data: Optional[List[UserDetailResponse]] = None
    total: int
    page: int
    page_size: int
    pages: int


class UserCreateRequest(BaseModel):
    email: EmailStr = Field(..., description="Unique email address")
    password: str = Field(..., min_length=8, description="Initial password")
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    role_id: uuid.UUID = Field(..., description="Assigned role ID")
    department_id: Optional[uuid.UUID] = None
    company_id: Optional[uuid.UUID] = None
    phone: Optional[str] = None
    is_active: bool = True


class UserUpdateRequest(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    role_id: Optional[uuid.UUID] = None
    department_id: Optional[uuid.UUID] = None
    company_id: Optional[uuid.UUID] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    is_locked: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=8, description="Optional new password")


class ApproverOptionResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    role_name: str
    department_id: Optional[uuid.UUID] = None
    company_id: Optional[uuid.UUID] = None

    model_config = {"from_attributes": True}


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

@router.get(
    "/approvers",
    response_model=List[ApproverOptionResponse],
    status_code=status.HTTP_200_OK,
    summary="List Eligible Approvers",
    description="Returns list of active approver users (Directors, Department Heads, and Super Admins).",
)
async def list_approvers(
    company_id: Optional[uuid.UUID] = Query(None, description="Filter by company"),
    department_id: Optional[uuid.UUID] = Query(None, description="Filter by department"),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(User)
        .join(User.role)
        .where(
            User.is_active == True,
            User.is_deleted == False,
            Role.name.in_([
                RoleEnum.SUPER_ADMIN.value,
                RoleEnum.DIRECTOR.value,
                RoleEnum.DEPARTMENT_HEAD.value,
            ]),
        )
    )

    if company_id:
        query = query.where(User.company_id == company_id)
    if department_id:
        query = query.where(User.department_id == department_id)

    query = query.order_by(User.first_name.asc(), User.last_name.asc())
    result = await db.execute(query)
    users = result.scalars().all()

    return [
        ApproverOptionResponse(
            id=u.id,
            full_name=u.full_name,
            email=u.email,
            role_name=u.role.name if u.role else "user",
            department_id=u.department_id,
            company_id=u.company_id,
        )
        for u in users
    ]


@router.get(
    "",
    response_model=UserListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Users",
    description="Retrieves a paginated list of users with optional role, department, and company filters.",
)
async def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    role: Optional[str] = Query(None, description="Filter by role name"),
    department_id: Optional[uuid.UUID] = Query(None, description="Filter by department"),
    company_id: Optional[uuid.UUID] = Query(None, description="Filter by company"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
):
    base_query = select(User).options(selectinload(User.role)).where(User.is_deleted == False)

    if search:
        search_filter = f"%{search.strip()}%"
        base_query = base_query.where(
            or_(
                User.first_name.ilike(search_filter),
                User.last_name.ilike(search_filter),
                User.email.ilike(search_filter),
            )
        )
    if department_id:
        base_query = base_query.where(User.department_id == department_id)
    if company_id:
        base_query = base_query.where(User.company_id == company_id)
    if is_active is not None:
        base_query = base_query.where(User.is_active == is_active)
    if role:
        base_query = base_query.join(User.role).where(Role.name == role)

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = base_query.order_by(User.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    users = result.scalars().all()

    pages = (total + page_size - 1) // page_size if total > 0 else 1

    user_items = [UserDetailResponse.model_validate(u) for u in users]
    return UserListResponse(
        items=user_items,
        data=user_items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.post(
    "",
    response_model=UserDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create User",
    description="Registers a new user account under the specified role and organization unit.",
)
async def create_user(
    request: Request,
    user_in: UserCreateRequest,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check if email is already in use
    email_clean = user_in.email.lower().strip()
    existing_query = select(User).where(User.email == email_clean, User.is_deleted == False)
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A user with email '{email_clean}' already exists.",
        )

    # Validate role exists
    role_query = select(Role).where(Role.id == user_in.role_id)
    role_res = await db.execute(role_query)
    role_obj = role_res.scalar_one_or_none()
    if not role_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Specified role_id does not exist.",
        )

    new_user = User(
        email=email_clean,
        password_hash=hash_password(user_in.password),
        first_name=user_in.first_name.strip(),
        last_name=user_in.last_name.strip(),
        role_id=user_in.role_id,
        department_id=user_in.department_id,
        company_id=user_in.company_id,
        phone=user_in.phone.strip() if user_in.phone else None,
        is_active=user_in.is_active,
        is_locked=False,
    )
    db.add(new_user)
    await db.flush()

    # Audit log
    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.USER_CREATED,
        entity_type="user",
        entity_id=new_user.id,
        new_value={"email": new_user.email, "role": role_obj.name},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    # Re-fetch with loaded role
    re_query = select(User).options(selectinload(User.role)).where(User.id == new_user.id)
    re_res = await db.execute(re_query)
    user_created = re_res.scalar_one()

    return UserDetailResponse.model_validate(user_created)


@router.get(
    "/{id}",
    response_model=UserDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get User By ID",
    description="Retrieves profile and assignment information for a specific user.",
)
async def get_user_by_id(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(User)
        .options(selectinload(User.role))
        .where(User.id == id, User.is_deleted == False)
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{id}' was not found.",
        )

    return UserDetailResponse.model_validate(user)


@router.put(
    "/{id}",
    response_model=UserDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Update User",
    description="Modifies existing user details, organizational assignment, or lock status.",
)
async def update_user(
    id: uuid.UUID,
    user_in: UserUpdateRequest,
    request: Request,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(User)
        .options(selectinload(User.role))
        .where(User.id == id, User.is_deleted == False)
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{id}' was not found.",
        )

    previous_state = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role_id": str(user.role_id),
        "department_id": str(user.department_id) if user.department_id else None,
        "company_id": str(user.company_id) if user.company_id else None,
        "is_active": user.is_active,
        "is_locked": user.is_locked,
    }

    if user_in.first_name is not None:
        user.first_name = user_in.first_name.strip()
    if user_in.last_name is not None:
        user.last_name = user_in.last_name.strip()
    if user_in.role_id is not None:
        # Validate role exists
        r_res = await db.execute(select(Role).where(Role.id == user_in.role_id))
        if not r_res.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role_id.")
        user.role_id = user_in.role_id
    if user_in.department_id is not None:
        user.department_id = user_in.department_id
    if user_in.company_id is not None:
        user.company_id = user_in.company_id
    if user_in.phone is not None:
        user.phone = user_in.phone.strip()
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    if user_in.is_locked is not None:
        user.is_locked = user_in.is_locked
        if not user_in.is_locked:
            user.failed_login_attempts = 0
    if user_in.password:
        user.password_hash = hash_password(user_in.password)

    new_state = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role_id": str(user.role_id),
        "department_id": str(user.department_id) if user.department_id else None,
        "company_id": str(user.company_id) if user.company_id else None,
        "is_active": user.is_active,
        "is_locked": user.is_locked,
    }

    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.USER_UPDATED,
        entity_type="user",
        entity_id=user.id,
        previous_value=previous_state,
        new_value=new_state,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    # Reload with role
    re_query = select(User).options(selectinload(User.role)).where(User.id == user.id)
    re_res = await db.execute(re_query)
    updated_user = re_res.scalar_one()

    return UserDetailResponse.model_validate(updated_user)


@router.delete(
    "/{id}",
    status_code=status.HTTP_200_OK,
    summary="Delete User Account",
    description="Deletes the specified user account from the system.",
)
async def delete_user(
    id: uuid.UUID,
    request: Request,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot delete their own active account.",
        )

    query = select(User).where(User.id == id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{id}' was not found.",
        )

    deleted_email = user.email

    # Try hard delete first if user has no dependencies, otherwise clean soft-delete
    try:
        await db.delete(user)
    except Exception:
        user.is_active = False
        user.is_deleted = True
        user.email = f"{deleted_email}.deleted.{int(datetime.now().timestamp())}"

    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.USER_DELETED,
        entity_type="user",
        entity_id=id,
        previous_value={"email": deleted_email, "is_active": True},
        new_value={"is_deleted": True},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    return {"success": True, "message": f"User '{deleted_email}' has been successfully deleted."}

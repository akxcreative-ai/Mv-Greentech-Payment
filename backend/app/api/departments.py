"""
Department Master API Router (Admin Only).

Provides CRUD operations for company departments:
- GET /api/departments - List departments with company filtering and pagination
- POST /api/departments - Create a new department
- GET /api/departments/{id} - Get department details
- PUT /api/departments/{id} - Update department name, code, head, or status
- DELETE /api/departments/{id} - Deactivate department
"""

from datetime import datetime
import logging
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.middleware.rate_limit import get_client_ip
from app.models.audit_log import AuditEventType, AuditLog
from app.models.company import Company
from app.models.department import Department
from app.models.role import RoleEnum
from app.models.user import User

logger = logging.getLogger("mv-payment-approval.api.departments")

router = APIRouter(
    prefix="/departments",
    tags=["Departments"],
    dependencies=[Depends(require_role(RoleEnum.SUPER_ADMIN))],
)


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class DepartmentHeadInfo(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str

    model_config = {"from_attributes": True}


class DepartmentResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    company_id: uuid.UUID
    head_id: Optional[uuid.UUID] = None
    head: Optional[DepartmentHeadInfo] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DepartmentListResponse(BaseModel):
    items: List[DepartmentResponse]
    data: Optional[List[DepartmentResponse]] = None
    total: int
    page: int
    page_size: int
    pages: int


class DepartmentCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Department name (e.g. Accounts)")
    code: str = Field(..., min_length=1, max_length=50, description="Department code (e.g. ACC)")
    company_id: uuid.UUID = Field(..., description="Parent company ID")
    head_id: Optional[uuid.UUID] = Field(None, description="Department head user ID")
    is_active: bool = True


class DepartmentUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    head_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

@router.get(
    "",
    response_model=DepartmentListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Departments",
    description="Returns a paginated list of departments with optional company filtering.",
)
async def list_departments(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    company_id: Optional[uuid.UUID] = Query(None, description="Filter by company"),
    search: Optional[str] = Query(None, description="Search by name or code"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
):
    base_query = select(Department).options(selectinload(Department.head))

    if company_id:
        base_query = base_query.where(Department.company_id == company_id)
    if is_active is not None:
        base_query = base_query.where(Department.is_active == is_active)
    if search:
        search_filter = f"%{search.strip()}%"
        base_query = base_query.where(
            or_(
                Department.name.ilike(search_filter),
                Department.code.ilike(search_filter),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = base_query.order_by(Department.name.asc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    departments = result.scalars().all()

    pages = (total + page_size - 1) // page_size if total > 0 else 1

    dept_list = [DepartmentResponse.model_validate(d) for d in departments]
    return DepartmentListResponse(
        items=dept_list,
        data=dept_list,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.post(
    "",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Department",
    description="Creates a new organizational department within a company.",
)
async def create_department(
    request: Request,
    payload_in: DepartmentCreateRequest,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clean_code = payload_in.code.upper().strip()

    # Validate company exists
    comp_q = select(Company).where(Company.id == payload_in.company_id)
    comp_res = await db.execute(comp_q)
    if not comp_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid company_id.")

    # Validate code unique per company
    existing_q = select(Department).where(
        Department.company_id == payload_in.company_id,
        Department.code == clean_code,
    )
    existing_res = await db.execute(existing_q)
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Department with code '{clean_code}' already exists in this company.",
        )

    # Validate head_id if specified
    if payload_in.head_id:
        user_check = await db.execute(select(User).where(User.id == payload_in.head_id, User.is_deleted == False))
        if not user_check.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid head_id user.")

    dept = Department(
        name=payload_in.name.strip(),
        code=clean_code,
        company_id=payload_in.company_id,
        head_id=payload_in.head_id,
        is_active=payload_in.is_active,
    )
    db.add(dept)
    await db.flush()

    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.DEPARTMENT_CREATED,
        entity_type="department",
        entity_id=dept.id,
        new_value={"name": dept.name, "code": dept.code, "company_id": str(dept.company_id)},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    re_q = select(Department).options(selectinload(Department.head)).where(Department.id == dept.id)
    re_res = await db.execute(re_q)
    return DepartmentResponse.model_validate(re_res.scalar_one())


@router.get(
    "/all",
    response_model=List[DepartmentResponse],
    status_code=status.HTTP_200_OK,
    summary="Get All Departments (Unpaginated)",
)
async def get_all_departments(
    company_id: Optional[uuid.UUID] = Query(None),
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Department).options(selectinload(Department.head))
    if company_id is not None:
        query = query.where(Department.company_id == company_id)
    if is_active is not None:
        query = query.where(Department.is_active == is_active)
    result = await db.execute(query.order_by(Department.name.asc()))
    departments = result.scalars().all()
    return [DepartmentResponse.model_validate(d) for d in departments]


@router.get(
    "/{id}",
    response_model=DepartmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Department By ID",
    description="Retrieves department metadata and designated head.",
)
async def get_department(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    query = select(Department).options(selectinload(Department.head)).where(Department.id == id)
    result = await db.execute(query)
    dept = result.scalar_one_or_none()

    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID '{id}' was not found.",
        )

    return DepartmentResponse.model_validate(dept)


@router.put(
    "/{id}",
    response_model=DepartmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Department",
    description="Updates department attributes, code, or department head.",
)
async def update_department(
    id: uuid.UUID,
    payload_in: DepartmentUpdateRequest,
    request: Request,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Department).options(selectinload(Department.head)).where(Department.id == id)
    result = await db.execute(query)
    dept = result.scalar_one_or_none()

    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID '{id}' was not found.",
        )

    prev_vals = {
        "name": dept.name,
        "code": dept.code,
        "head_id": str(dept.head_id) if dept.head_id else None,
        "is_active": dept.is_active,
    }

    if payload_in.name is not None:
        dept.name = payload_in.name.strip()
    if payload_in.code is not None:
        new_code = payload_in.code.upper().strip()
        if new_code != dept.code:
            code_check = await db.execute(
                select(Department).where(
                    Department.company_id == dept.company_id,
                    Department.code == new_code,
                    Department.id != dept.id,
                )
            )
            if code_check.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Department with code '{new_code}' already exists in this company.",
                )
            dept.code = new_code
    if payload_in.head_id is not None:
        if payload_in.head_id:
            u_check = await db.execute(select(User).where(User.id == payload_in.head_id, User.is_deleted == False))
            if not u_check.scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid head_id user.")
        dept.head_id = payload_in.head_id
    if payload_in.is_active is not None:
        dept.is_active = payload_in.is_active

    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.DEPARTMENT_UPDATED,
        entity_type="department",
        entity_id=dept.id,
        previous_value=prev_vals,
        new_value={"name": dept.name, "code": dept.code, "is_active": dept.is_active},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    re_q = select(Department).options(selectinload(Department.head)).where(Department.id == dept.id)
    re_res = await db.execute(re_q)
    return DepartmentResponse.model_validate(re_res.scalar_one())


@router.delete(
    "/{id}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate Department",
    description="Deactivates an existing department.",
)
async def delete_department(
    id: uuid.UUID,
    request: Request,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Department).where(Department.id == id)
    result = await db.execute(query)
    dept = result.scalar_one_or_none()

    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID '{id}' was not found.",
        )

    dept.is_active = False

    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.DEPARTMENT_UPDATED,
        entity_type="department",
        entity_id=dept.id,
        previous_value={"is_active": True},
        new_value={"is_active": False, "action": "deactivated"},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    return {"success": True, "message": f"Department '{dept.name}' has been deactivated."}

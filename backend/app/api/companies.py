"""
Company Master API Router (Admin Only).

Provides CRUD management for operating entities/companies within the enterprise:
- GET /api/companies - List companies with search and pagination
- POST /api/companies - Register a new company entity
- GET /api/companies/{id} - Get specific company details
- PUT /api/companies/{id} - Update company details and branding
- DELETE /api/companies/{id} - Deactivate company
"""

from datetime import datetime
import logging
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.middleware.rate_limit import get_client_ip
from app.models.audit_log import AuditEventType, AuditLog
from app.models.company import Company
from app.models.role import RoleEnum
from app.models.user import User

logger = logging.getLogger("mv-payment-approval.api.companies")

router = APIRouter(
    prefix="/companies",
    tags=["Companies"],
    dependencies=[Depends(require_role(RoleEnum.SUPER_ADMIN))],
)


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class CompanyResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CompanyListResponse(BaseModel):
    items: List[CompanyResponse]
    data: Optional[List[CompanyResponse]] = None
    total: int
    page: int
    page_size: int
    pages: int


class CompanyCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Legal company name")
    code: str = Field(..., min_length=1, max_length=50, description="Unique short code (e.g. MV-CORP)")
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    gst_number: Optional[str] = Field(None, max_length=15, description="GSTIN identifier")
    pan_number: Optional[str] = Field(None, max_length=10, description="PAN identifier")
    logo_url: Optional[str] = None
    is_active: bool = True
    primary_color: Optional[str] = "#1E40AF"
    secondary_color: Optional[str] = "#3B82F6"


class CompanyUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    gst_number: Optional[str] = Field(None, max_length=15)
    pan_number: Optional[str] = Field(None, max_length=10)
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

@router.get(
    "",
    response_model=CompanyListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Companies",
    description="Returns a paginated list of registered companies with optional keyword filtering.",
)
async def list_companies(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    search: Optional[str] = Query(None, description="Search by name, code, or GSTIN"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
):
    base_query = select(Company)

    if is_active is not None:
        base_query = base_query.where(Company.is_active == is_active)

    if search:
        search_filter = f"%{search.strip()}%"
        base_query = base_query.where(
            or_(
                Company.name.ilike(search_filter),
                Company.code.ilike(search_filter),
                Company.gst_number.ilike(search_filter),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = base_query.order_by(Company.name.asc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    companies = result.scalars().all()

    pages = (total + page_size - 1) // page_size if total > 0 else 1

    comp_list = [CompanyResponse.model_validate(c) for c in companies]
    return CompanyListResponse(
        items=comp_list,
        data=comp_list,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.post(
    "",
    response_model=CompanyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Company",
    description="Registers a new company entity in the system.",
)
async def create_company(
    request: Request,
    payload_in: CompanyCreateRequest,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clean_code = payload_in.code.upper().strip()

    # Check unique code
    existing_q = select(Company).where(Company.code == clean_code)
    existing_res = await db.execute(existing_q)
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Company with code '{clean_code}' already exists.",
        )

    company = Company(
        name=payload_in.name.strip(),
        code=clean_code,
        address=payload_in.address,
        phone=payload_in.phone,
        email=str(payload_in.email) if payload_in.email else None,
        gst_number=payload_in.gst_number.upper().strip() if payload_in.gst_number else None,
        pan_number=payload_in.pan_number.upper().strip() if payload_in.pan_number else None,
        logo_url=payload_in.logo_url,
        is_active=payload_in.is_active,
        primary_color=payload_in.primary_color,
        secondary_color=payload_in.secondary_color,
    )
    db.add(company)
    await db.flush()

    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.COMPANY_CREATED,
        entity_type="company",
        entity_id=company.id,
        new_value={"name": company.name, "code": company.code},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()
    await db.refresh(company)

    return CompanyResponse.model_validate(company)


@router.get(
    "/all",
    response_model=List[CompanyResponse],
    status_code=status.HTTP_200_OK,
    summary="Get All Companies (Unpaginated)",
)
async def get_all_companies(
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Company)
    if is_active is not None:
        query = query.where(Company.is_active == is_active)
    result = await db.execute(query.order_by(Company.name.asc()))
    companies = result.scalars().all()
    return [CompanyResponse.model_validate(c) for c in companies]


@router.get(
    "/{id}",
    response_model=CompanyResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Company By ID",
    description="Fetches entity details for the specified company ID.",
)
async def get_company(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    query = select(Company).where(Company.id == id)
    result = await db.execute(query)
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID '{id}' was not found.",
        )

    return CompanyResponse.model_validate(company)


@router.put(
    "/{id}",
    response_model=CompanyResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Company",
    description="Updates existing company entity attributes.",
)
async def update_company(
    id: uuid.UUID,
    payload_in: CompanyUpdateRequest,
    request: Request,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Company).where(Company.id == id)
    result = await db.execute(query)
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID '{id}' was not found.",
        )

    prev_vals = {
        "name": company.name,
        "code": company.code,
        "is_active": company.is_active,
    }

    if payload_in.name is not None:
        company.name = payload_in.name.strip()
    if payload_in.code is not None:
        new_code = payload_in.code.upper().strip()
        if new_code != company.code:
            code_check = await db.execute(select(Company).where(Company.code == new_code))
            if code_check.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Company with code '{new_code}' already exists.",
                )
            company.code = new_code
    if payload_in.address is not None:
        company.address = payload_in.address
    if payload_in.phone is not None:
        company.phone = payload_in.phone
    if payload_in.email is not None:
        company.email = str(payload_in.email)
    if payload_in.gst_number is not None:
        company.gst_number = payload_in.gst_number.upper().strip() if payload_in.gst_number else None
    if payload_in.pan_number is not None:
        company.pan_number = payload_in.pan_number.upper().strip() if payload_in.pan_number else None
    if payload_in.logo_url is not None:
        company.logo_url = payload_in.logo_url
    if payload_in.is_active is not None:
        company.is_active = payload_in.is_active
    if payload_in.primary_color is not None:
        company.primary_color = payload_in.primary_color
    if payload_in.secondary_color is not None:
        company.secondary_color = payload_in.secondary_color

    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.COMPANY_UPDATED,
        entity_type="company",
        entity_id=company.id,
        previous_value=prev_vals,
        new_value={"name": company.name, "code": company.code, "is_active": company.is_active},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()
    await db.refresh(company)

    return CompanyResponse.model_validate(company)


@router.delete(
    "/{id}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate Company",
    description="Deactivates a company record.",
)
async def delete_company(
    id: uuid.UUID,
    request: Request,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Company).where(Company.id == id)
    result = await db.execute(query)
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID '{id}' was not found.",
        )

    company.is_active = False

    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.COMPANY_UPDATED,
        entity_type="company",
        entity_id=company.id,
        previous_value={"is_active": True},
        new_value={"is_active": False, "action": "deactivated"},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    return {"success": True, "message": f"Company '{company.name}' has been deactivated."}

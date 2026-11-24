"""
Vendor Master API Router.

Implements vendor directory and disbursement banking details management:
- GET /api/vendors - List vendors (All authenticated users)
- POST /api/vendors - Create new vendor (Admin / Accountant)
- GET /api/vendors/{id} - Retrieve vendor details (All authenticated users)
- PUT /api/vendors/{id} - Update vendor information (Admin only)
- GET /api/vendors/{id}/bank-details - Retrieve sensitive banking coordinates (Admin / Accountant only)
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
from app.models.vendor import Vendor

logger = logging.getLogger("mv-payment-approval.api.vendors")

router = APIRouter(prefix="/vendors", tags=["Vendors"])


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class VendorBaseResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    company_id: uuid.UUID
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VendorDetailResponse(VendorBaseResponse):
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    # Masked bank account for non-financial viewers
    masked_bank_account: Optional[str] = None


class VendorBankDetailsResponse(BaseModel):
    id: uuid.UUID
    vendor_name: str
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_branch: Optional[str] = None


class VendorListResponse(BaseModel):
    items: List[VendorDetailResponse]
    total: int
    page: int
    page_size: int
    pages: int


class VendorCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Vendor legal name")
    code: str = Field(..., min_length=1, max_length=50, description="Vendor code (e.g. VEND-001)")
    company_id: uuid.UUID = Field(..., description="Company entity this vendor is linked to")
    contact_person: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = Field(None, max_length=15)
    pan_number: Optional[str] = Field(None, max_length=10)
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_branch: Optional[str] = None
    is_active: bool = True


class VendorUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    contact_person: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = Field(None, max_length=15)
    pan_number: Optional[str] = Field(None, max_length=10)
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_branch: Optional[str] = None
    is_active: Optional[bool] = None


def mask_account(acct: Optional[str]) -> Optional[str]:
    """Helper to mask bank account numbers, showing only last 4 digits."""
    if not acct:
        return None
    acct_clean = acct.strip()
    if len(acct_clean) <= 4:
        return "****"
    return f"{'*' * (len(acct_clean) - 4)}{acct_clean[-4:]}"


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

@router.get(
    "",
    response_model=VendorListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Vendors",
    description="Retrieves a list of vendors available to the current user's organization.",
)
async def list_vendors(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    company_id: Optional[uuid.UUID] = Query(None, description="Filter by company"),
    search: Optional[str] = Query(None, description="Search by name, code, GST, or PAN"),
    is_active: Optional[bool] = Query(None, description="Filter active status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base_query = select(Vendor).where(Vendor.is_deleted == False)

    # Restrict by company if non-admin and company_id not explicitly queried
    target_company = company_id or current_user.company_id
    if target_company and current_user.role.name != RoleEnum.SUPER_ADMIN.value:
        base_query = base_query.where(Vendor.company_id == target_company)
    elif company_id:
        base_query = base_query.where(Vendor.company_id == company_id)

    if is_active is not None:
        base_query = base_query.where(Vendor.is_active == is_active)

    if search:
        search_filter = f"%{search.strip()}%"
        base_query = base_query.where(
            or_(
                Vendor.name.ilike(search_filter),
                Vendor.code.ilike(search_filter),
                Vendor.gst_number.ilike(search_filter),
                Vendor.pan_number.ilike(search_filter),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = base_query.order_by(Vendor.name.asc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    vendors = result.scalars().all()

    items = []
    for v in vendors:
        v_dict = VendorDetailResponse.model_validate(v)
        v_dict.masked_bank_account = mask_account(v.bank_account_number)
        items.append(v_dict)

    pages = (total + page_size - 1) // page_size if total > 0 else 1

    return VendorListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.post(
    "",
    response_model=VendorDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Vendor",
    description="Registers a new vendor entity. Allowed for Admin or Accountant roles.",
    dependencies=[Depends(require_role(RoleEnum.SUPER_ADMIN, RoleEnum.ACCOUNTANT))],
)
async def create_vendor(
    request: Request,
    payload_in: VendorCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clean_code = payload_in.code.upper().strip()

    # Check company exists
    comp_q = select(Company).where(Company.id == payload_in.company_id)
    comp_res = await db.execute(comp_q)
    if not comp_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid company_id.")

    # Check unique code within company
    exist_q = select(Vendor).where(
        Vendor.company_id == payload_in.company_id,
        Vendor.code == clean_code,
        Vendor.is_deleted == False,
    )
    exist_res = await db.execute(exist_q)
    if exist_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Vendor with code '{clean_code}' already exists for this company.",
        )

    vendor = Vendor(
        name=payload_in.name.strip(),
        code=clean_code,
        company_id=payload_in.company_id,
        contact_person=payload_in.contact_person,
        email=str(payload_in.email) if payload_in.email else None,
        phone=payload_in.phone,
        address=payload_in.address,
        gst_number=payload_in.gst_number.upper().strip() if payload_in.gst_number else None,
        pan_number=payload_in.pan_number.upper().strip() if payload_in.pan_number else None,
        bank_name=payload_in.bank_name,
        bank_account_number=payload_in.bank_account_number,
        bank_ifsc=payload_in.bank_ifsc.upper().strip() if payload_in.bank_ifsc else None,
        bank_branch=payload_in.bank_branch,
        is_active=payload_in.is_active,
    )
    db.add(vendor)
    await db.flush()

    audit = AuditLog(
        user_id=current_user.id,
        event_type=AuditEventType.VENDOR_CREATED,
        entity_type="vendor",
        entity_id=vendor.id,
        new_value={"name": vendor.name, "code": vendor.code, "company_id": str(vendor.company_id)},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()
    await db.refresh(vendor)

    resp = VendorDetailResponse.model_validate(vendor)
    resp.masked_bank_account = mask_account(vendor.bank_account_number)
    return resp


@router.get(
    "/{id}",
    response_model=VendorDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Vendor Details",
    description="Fetches public / general vendor attributes with masked bank account.",
)
async def get_vendor(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Vendor).where(Vendor.id == id, Vendor.is_deleted == False)
    result = await db.execute(query)
    vendor = result.scalar_one_or_none()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor with ID '{id}' was not found.",
        )

    resp = VendorDetailResponse.model_validate(vendor)
    resp.masked_bank_account = mask_account(vendor.bank_account_number)
    return resp


@router.put(
    "/{id}",
    response_model=VendorDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Vendor",
    description="Updates master vendor profile details. Restricted to Super Admin.",
    dependencies=[Depends(require_role(RoleEnum.SUPER_ADMIN))],
)
async def update_vendor(
    id: uuid.UUID,
    payload_in: VendorUpdateRequest,
    request: Request,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Vendor).where(Vendor.id == id, Vendor.is_deleted == False)
    result = await db.execute(query)
    vendor = result.scalar_one_or_none()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor with ID '{id}' was not found.",
        )

    prev_vals = {
        "name": vendor.name,
        "code": vendor.code,
        "is_active": vendor.is_active,
    }

    if payload_in.name is not None:
        vendor.name = payload_in.name.strip()
    if payload_in.code is not None:
        new_code = payload_in.code.upper().strip()
        if new_code != vendor.code:
            code_chk = await db.execute(
                select(Vendor).where(
                    Vendor.company_id == vendor.company_id,
                    Vendor.code == new_code,
                    Vendor.id != vendor.id,
                    Vendor.is_deleted == False,
                )
            )
            if code_chk.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Vendor code '{new_code}' already exists in this company.",
                )
            vendor.code = new_code
    if payload_in.contact_person is not None:
        vendor.contact_person = payload_in.contact_person
    if payload_in.email is not None:
        vendor.email = str(payload_in.email)
    if payload_in.phone is not None:
        vendor.phone = payload_in.phone
    if payload_in.address is not None:
        vendor.address = payload_in.address
    if payload_in.gst_number is not None:
        vendor.gst_number = payload_in.gst_number.upper().strip() if payload_in.gst_number else None
    if payload_in.pan_number is not None:
        vendor.pan_number = payload_in.pan_number.upper().strip() if payload_in.pan_number else None
    if payload_in.bank_name is not None:
        vendor.bank_name = payload_in.bank_name
    if payload_in.bank_account_number is not None:
        vendor.bank_account_number = payload_in.bank_account_number
    if payload_in.bank_ifsc is not None:
        vendor.bank_ifsc = payload_in.bank_ifsc.upper().strip() if payload_in.bank_ifsc else None
    if payload_in.bank_branch is not None:
        vendor.bank_branch = payload_in.bank_branch
    if payload_in.is_active is not None:
        vendor.is_active = payload_in.is_active

    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.VENDOR_UPDATED,
        entity_type="vendor",
        entity_id=vendor.id,
        previous_value=prev_vals,
        new_value={"name": vendor.name, "code": vendor.code, "is_active": vendor.is_active},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()
    await db.refresh(vendor)

    resp = VendorDetailResponse.model_validate(vendor)
    resp.masked_bank_account = mask_account(vendor.bank_account_number)
    return resp


@router.get(
    "/{id}/bank-details",
    response_model=VendorBankDetailsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Vendor Banking Details",
    description="Retrieves full beneficiary banking coordinates for payment disbursement. Restricted to Accountant or Admin.",
    dependencies=[Depends(require_role(RoleEnum.SUPER_ADMIN, RoleEnum.ACCOUNTANT))],
)
async def get_vendor_bank_details(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Vendor).where(Vendor.id == id, Vendor.is_deleted == False)
    result = await db.execute(query)
    vendor = result.scalar_one_or_none()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor with ID '{id}' was not found.",
        )

    return VendorBankDetailsResponse(
        id=vendor.id,
        vendor_name=vendor.name,
        bank_name=vendor.bank_name,
        bank_account_number=vendor.bank_account_number,
        bank_ifsc=vendor.bank_ifsc,
        bank_branch=vendor.bank_branch,
    )


@router.delete(
    "/{id}",
    status_code=status.HTTP_200_OK,
    summary="Delete / Deactivate Vendor",
    description="Soft-deletes and deactivates a vendor record. Restricted to Super Admin.",
    dependencies=[Depends(require_role(RoleEnum.SUPER_ADMIN))],
)
async def delete_vendor(
    id: uuid.UUID,
    request: Request,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Vendor).where(Vendor.id == id, Vendor.is_deleted == False)
    result = await db.execute(query)
    vendor = result.scalar_one_or_none()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor with ID '{id}' was not found.",
        )

    vendor.is_active = False
    vendor.soft_delete()

    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.VENDOR_DELETED,
        entity_type="vendor",
        entity_id=vendor.id,
        previous_value={"name": vendor.name, "code": vendor.code, "is_active": True},
        new_value={"is_active": False, "is_deleted": True},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    return {"success": True, "message": f"Vendor '{vendor.name}' has been deactivated."}


"""
System Settings and Approval Rules API Router (Admin Only).

Manages global configuration parameters and company threshold matrix:
- GET /api/settings - List global system parameters
- PUT /api/settings/{key} - Update configuration value
- GET /api/settings/approval-rules - List tiered threshold matrix rules
- POST /api/settings/approval-rules - Create new approval threshold rule
- PUT /api/settings/approval-rules/{id} - Update threshold rule
- DELETE /api/settings/approval-rules/{id} - Delete / deactivate threshold rule
"""

from datetime import datetime
from decimal import Decimal
import logging
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.middleware.rate_limit import get_client_ip
from app.models.audit_log import AuditEventType, AuditLog
from app.models.company import Company
from app.models.role import RoleEnum
from app.models.settings import ApprovalRule, SystemSettings
from app.models.user import User

logger = logging.getLogger("mv-payment-approval.api.settings")

router = APIRouter(
    prefix="/settings",
    tags=["Settings"],
    dependencies=[Depends(require_role(RoleEnum.SUPER_ADMIN))],
)


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class SystemSettingResponse(BaseModel):
    id: uuid.UUID
    key: str
    value: Any
    description: Optional[str] = None
    updated_by_id: Optional[uuid.UUID] = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class SystemSettingUpdateRequest(BaseModel):
    value: Any = Field(..., description="Configuration value (supports strings, numbers, dicts, arrays)")
    description: Optional[str] = None


class ApprovalRuleResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    min_amount: Decimal
    max_amount: Optional[Decimal] = None
    requires_approval: bool
    approver_role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ApprovalRuleCreateRequest(BaseModel):
    company_id: uuid.UUID = Field(..., description="Company entity for this threshold rule")
    min_amount: Decimal = Field(default=Decimal("0.00"), ge=0, description="Minimum monetary limit")
    max_amount: Optional[Decimal] = Field(None, ge=0, description="Upper threshold (null for unbounded)")
    requires_approval: bool = True
    approver_role: str = Field(..., description="Role required for approving requests in this range")
    is_active: bool = True


class ApprovalRuleUpdateRequest(BaseModel):
    min_amount: Optional[Decimal] = Field(None, ge=0)
    max_amount: Optional[Decimal] = Field(None, ge=0)
    requires_approval: Optional[bool] = None
    approver_role: Optional[str] = None
    is_active: Optional[bool] = None


# --------------------------------------------------------------------------
# Global System Settings Endpoints
# --------------------------------------------------------------------------

@router.get(
    "",
    response_model=List[SystemSettingResponse],
    status_code=status.HTTP_200_OK,
    summary="List System Settings",
    description="Retrieves all registered application configuration key-value pairs.",
)
async def list_settings(
    db: AsyncSession = Depends(get_db),
):
    query = select(SystemSettings).order_by(SystemSettings.key.asc())
    result = await db.execute(query)
    settings_list = result.scalars().all()
    return [SystemSettingResponse.model_validate(s) for s in settings_list]


@router.put(
    "/{key}",
    response_model=SystemSettingResponse,
    status_code=status.HTTP_200_OK,
    summary="Update System Setting",
    description="Updates or registers a configuration parameter.",
)
async def update_setting(
    key: str,
    payload_in: SystemSettingUpdateRequest,
    request: Request,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clean_key = key.strip().upper()
    query = select(SystemSettings).where(SystemSettings.key == clean_key)
    result = await db.execute(query)
    setting = result.scalar_one_or_none()

    prev_val = None
    if setting:
        prev_val = setting.value
        setting.value = payload_in.value
        if payload_in.description is not None:
            setting.description = payload_in.description
        setting.updated_by_id = current_admin.id
    else:
        setting = SystemSettings(
            key=clean_key,
            value=payload_in.value,
            description=payload_in.description,
            updated_by_id=current_admin.id,
        )
        db.add(setting)

    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.SETTINGS_UPDATED,
        entity_type="system_settings",
        entity_id=setting.id if hasattr(setting, "id") and setting.id else None,
        previous_value={"key": clean_key, "value": prev_val},
        new_value={"key": clean_key, "value": payload_in.value},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()
    await db.refresh(setting)

    return SystemSettingResponse.model_validate(setting)


@router.get(
    "/{key}",
    response_model=SystemSettingResponse,
    status_code=status.HTTP_200_OK,
    summary="Get System Setting By Key",
    description="Retrieves a specific configuration parameter by its unique key.",
)
async def get_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
):
    clean_key = key.strip().upper()
    query = select(SystemSettings).where(SystemSettings.key == clean_key)
    result = await db.execute(query)
    setting = result.scalar_one_or_none()

    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setting with key '{clean_key}' was not found.",
        )

    return SystemSettingResponse.model_validate(setting)


@router.delete(
    "/{key}",
    status_code=status.HTTP_200_OK,
    summary="Delete System Setting",
    description="Removes a custom configuration key and value.",
)
async def delete_setting(
    key: str,
    request: Request,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clean_key = key.strip().upper()
    query = select(SystemSettings).where(SystemSettings.key == clean_key)
    result = await db.execute(query)
    setting = result.scalar_one_or_none()

    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setting with key '{clean_key}' was not found.",
        )

    prev_val = setting.value
    await db.delete(setting)

    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.SETTINGS_UPDATED,
        entity_type="system_settings",
        entity_id=setting.id if hasattr(setting, "id") and setting.id else None,
        previous_value={"key": clean_key, "value": prev_val},
        new_value={"key": clean_key, "action": "deleted"},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    return {"success": True, "message": f"Setting '{clean_key}' was deleted successfully."}



# --------------------------------------------------------------------------
# Approval Rules Endpoints
# --------------------------------------------------------------------------

@router.get(
    "/approval-rules",
    response_model=List[ApprovalRuleResponse],
    status_code=status.HTTP_200_OK,
    summary="List Approval Rules",
    description="Retrieves configurable amount threshold tiers and required approver roles.",
)
async def list_approval_rules(
    company_id: Optional[uuid.UUID] = Query(None, description="Filter rules by company"),
    is_active: Optional[bool] = Query(None, description="Filter active status"),
    db: AsyncSession = Depends(get_db),
):
    query = select(ApprovalRule)

    if company_id:
        query = query.where(ApprovalRule.company_id == company_id)
    if is_active is not None:
        query = query.where(ApprovalRule.is_active == is_active)

    query = query.order_by(ApprovalRule.company_id, ApprovalRule.min_amount.asc())
    result = await db.execute(query)
    rules = result.scalars().all()

    return [ApprovalRuleResponse.model_validate(r) for r in rules]


@router.post(
    "/approval-rules",
    response_model=ApprovalRuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Approval Rule",
    description="Configures a new tiered monetary approval threshold for a company.",
)
async def create_approval_rule(
    payload_in: ApprovalRuleCreateRequest,
    request: Request,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify company exists
    comp_q = select(Company).where(Company.id == payload_in.company_id)
    comp_res = await db.execute(comp_q)
    if not comp_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid company_id.")

    if payload_in.max_amount is not None and payload_in.max_amount <= payload_in.min_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="max_amount must be greater than min_amount.",
        )

    rule = ApprovalRule(
        company_id=payload_in.company_id,
        min_amount=payload_in.min_amount,
        max_amount=payload_in.max_amount,
        requires_approval=payload_in.requires_approval,
        approver_role=payload_in.approver_role.strip().lower(),
        is_active=payload_in.is_active,
    )
    db.add(rule)
    await db.flush()

    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.APPROVAL_RULE_CREATED,
        entity_type="approval_rule",
        entity_id=rule.id,
        new_value={
            "company_id": str(rule.company_id),
            "range": [str(rule.min_amount), str(rule.max_amount)],
            "role": rule.approver_role,
        },
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()
    await db.refresh(rule)

    return ApprovalRuleResponse.model_validate(rule)


@router.put(
    "/approval-rules/{id}",
    response_model=ApprovalRuleResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Approval Rule",
    description="Modifies existing threshold limits or assigned approver role.",
)
async def update_approval_rule(
    id: uuid.UUID,
    payload_in: ApprovalRuleUpdateRequest,
    request: Request,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ApprovalRule).where(ApprovalRule.id == id)
    result = await db.execute(query)
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Approval rule with ID '{id}' was not found.",
        )

    prev_vals = {
        "min_amount": str(rule.min_amount),
        "max_amount": str(rule.max_amount) if rule.max_amount else None,
        "approver_role": rule.approver_role,
        "is_active": rule.is_active,
    }

    if payload_in.min_amount is not None:
        rule.min_amount = payload_in.min_amount
    if payload_in.max_amount is not None:
        rule.max_amount = payload_in.max_amount
    if payload_in.requires_approval is not None:
        rule.requires_approval = payload_in.requires_approval
    if payload_in.approver_role is not None:
        rule.approver_role = payload_in.approver_role.strip().lower()
    if payload_in.is_active is not None:
        rule.is_active = payload_in.is_active

    if rule.max_amount is not None and rule.max_amount <= rule.min_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="max_amount must be greater than min_amount.",
        )

    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.APPROVAL_RULE_UPDATED,
        entity_type="approval_rule",
        entity_id=rule.id,
        previous_value=prev_vals,
        new_value={
            "min_amount": str(rule.min_amount),
            "max_amount": str(rule.max_amount) if rule.max_amount else None,
            "role": rule.approver_role,
            "is_active": rule.is_active,
        },
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()
    await db.refresh(rule)

    return ApprovalRuleResponse.model_validate(rule)


@router.delete(
    "/approval-rules/{id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Approval Rule",
    description="Permanently deletes or deactivates an approval matrix rule.",
)
async def delete_approval_rule(
    id: uuid.UUID,
    request: Request,
    current_admin: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ApprovalRule).where(ApprovalRule.id == id)
    result = await db.execute(query)
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Approval rule with ID '{id}' was not found.",
        )

    await db.delete(rule)

    audit = AuditLog(
        user_id=current_admin.id,
        event_type=AuditEventType.APPROVAL_RULE_DELETED,
        entity_type="approval_rule",
        entity_id=id,
        previous_value={"company_id": str(rule.company_id), "role": rule.approver_role},
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
    )
    db.add(audit)
    await db.commit()

    return {"success": True, "message": "Approval rule deleted successfully."}

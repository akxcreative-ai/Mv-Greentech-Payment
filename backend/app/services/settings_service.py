"""
Settings and Approval Rules Management Service for MV Payment Approval System.

Manages application-wide key-value configurations and company-specific tiered approval matrix
thresholds with full audit trail logging.
"""

from decimal import Decimal
import logging
from typing import Any, Dict, List, Optional, Union
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit_log import AuditEventType
from app.models.company import Company
from app.models.settings import ApprovalRule, SystemSettings
from app.services.audit_service import log_event

logger = logging.getLogger(__name__)


def _extract_dict(data: Any) -> Dict[str, Any]:
    """Helper to convert Pydantic models or dicts to a standard dictionary."""
    if isinstance(data, dict):
        return data
    if hasattr(data, "model_dump"):
        return data.model_dump(exclude_unset=True)
    if hasattr(data, "dict"):
        return data.dict(exclude_unset=True)
    return dict(data)


# ==============================================================================
# SYSTEM SETTINGS (KEY-VALUE PAIRS)
# ==============================================================================


async def get_setting(
    key: str,
    db: AsyncSession,
    default: Any = None,
) -> Any:
    """
    Retrieves the value of a system setting by its configuration key.

    Args:
        key: Unique configuration key.
        db: Active AsyncSession database session.
        default: Fallback value if setting not found.

    Returns:
        The setting's deserialized value or default.
    """
    clean_key = str(key).strip()
    stmt = select(SystemSettings).where(SystemSettings.key == clean_key)
    result = await db.execute(stmt)
    setting = result.scalar_one_or_none()

    if setting is not None:
        return setting.value
    return default


async def set_setting(
    key: str,
    value: Any,
    user_id: Optional[Union[uuid.UUID, str]],
    db: AsyncSession,
    description: Optional[str] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> SystemSettings:
    """
    Creates or updates a system configuration setting with audit trail logging.

    Args:
        key: Unique setting key identifier.
        value: JSON-serializable setting value.
        user_id: Actor UUID making modification.
        db: Active AsyncSession database session.
        description: Explanatory label of what this configuration controls.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The created or updated SystemSettings model instance.
    """
    clean_key = str(key).strip()
    parsed_user_id: Optional[uuid.UUID] = None
    if user_id:
        parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

    stmt = select(SystemSettings).where(SystemSettings.key == clean_key)
    result = await db.execute(stmt)
    setting = result.scalar_one_or_none()

    if setting is not None:
        prev_val = {"key": setting.key, "value": setting.value}
        setting.value = value
        setting.updated_by_id = parsed_user_id
        if description is not None:
            setting.description = description
        new_val = {"key": setting.key, "value": setting.value}
        await db.flush()

        await log_event(
            user_id=parsed_user_id,
            event_type=AuditEventType.SETTINGS_UPDATED,
            entity_type="system_settings",
            entity_id=setting.id,
            previous_value=prev_val,
            new_value=new_val,
            ip=ip,
            user_agent=user_agent,
            db=db,
        )
        return setting
    else:
        new_setting = SystemSettings(
            key=clean_key,
            value=value,
            description=description,
            updated_by_id=parsed_user_id,
        )
        db.add(new_setting)
        await db.flush()

        await log_event(
            user_id=parsed_user_id,
            event_type=AuditEventType.SETTINGS_UPDATED,
            entity_type="system_settings",
            entity_id=new_setting.id,
            previous_value=None,
            new_value={"key": new_setting.key, "value": new_setting.value},
            ip=ip,
            user_agent=user_agent,
            db=db,
        )
        return new_setting


async def get_all_settings(
    db: AsyncSession,
) -> Dict[str, Any]:
    """
    Retrieves all registered system settings mapped as a dictionary of key-value pairs.

    Args:
        db: Active AsyncSession database session.

    Returns:
        Dictionary of {setting_key: setting_value}.
    """
    stmt = select(SystemSettings).order_by(SystemSettings.key.asc())
    result = await db.execute(stmt)
    records = result.scalars().all()
    return {rec.key: rec.value for rec in records}


# ==============================================================================
# APPROVAL RULES MANAGEMENT
# ==============================================================================


async def create_approval_rule(
    data: Union[Dict[str, Any], Any],
    user_id: Optional[Union[uuid.UUID, str]],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> ApprovalRule:
    """
    Creates a new tiered monetary approval rule for a company.

    Args:
        data: Approval rule configuration (company_id, min_amount, max_amount, approver_role, requires_approval).
        user_id: Actor UUID creating the rule.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The newly created ApprovalRule model instance.

    Raises:
        HTTPException: 400 Bad Request if validation fails, 404 if company does not exist.
    """
    payload = _extract_dict(data)

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

    approver_role = str(payload.get("approver_role", "")).strip().lower()
    if not approver_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Approver role is required (e.g. department_head, director, accountant).",
        )

    min_amount = Decimal(str(payload.get("min_amount", 0.00)))
    max_amount = Decimal(str(payload["max_amount"])) if payload.get("max_amount") is not None else None

    if max_amount is not None and max_amount < min_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"max_amount ({max_amount}) cannot be less than min_amount ({min_amount}).",
        )

    rule = ApprovalRule(
        company_id=parsed_company_id,
        min_amount=min_amount,
        max_amount=max_amount,
        approver_role=approver_role,
        requires_approval=payload.get("requires_approval", True),
        is_active=payload.get("is_active", True),
    )

    db.add(rule)
    await db.flush()

    await log_event(
        user_id=user_id,
        event_type=AuditEventType.APPROVAL_RULE_CREATED,
        entity_type="approval_rule",
        entity_id=rule.id,
        previous_value=None,
        new_value={
            "company_id": str(rule.company_id),
            "min_amount": float(rule.min_amount),
            "max_amount": float(rule.max_amount) if rule.max_amount is not None else None,
            "approver_role": rule.approver_role,
        },
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return rule


async def update_approval_rule(
    rule_id: Union[uuid.UUID, str],
    data: Union[Dict[str, Any], Any],
    user_id: Optional[Union[uuid.UUID, str]],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> ApprovalRule:
    """
    Updates an existing tiered approval rule.

    Args:
        rule_id: Target rule UUID.
        data: Updated fields dictionary or schema.
        user_id: Actor UUID performing update.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        The updated ApprovalRule model instance.

    Raises:
        HTTPException: 404 Not Found if rule doesn't exist, 400 Bad Request on invalid ranges.
    """
    parsed_id = rule_id if isinstance(rule_id, uuid.UUID) else uuid.UUID(str(rule_id))
    payload = _extract_dict(data)

    rule = await db.get(ApprovalRule, parsed_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ApprovalRule with ID '{parsed_id}' not found.",
        )

    previous_value = {
        "min_amount": float(rule.min_amount),
        "max_amount": float(rule.max_amount) if rule.max_amount is not None else None,
        "approver_role": rule.approver_role,
        "requires_approval": rule.requires_approval,
        "is_active": rule.is_active,
    }

    if "min_amount" in payload and payload["min_amount"] is not None:
        rule.min_amount = Decimal(str(payload["min_amount"]))

    if "max_amount" in payload:
        rule.max_amount = (
            Decimal(str(payload["max_amount"])) if payload["max_amount"] is not None else None
        )

    if rule.max_amount is not None and rule.max_amount < rule.min_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"max_amount ({rule.max_amount}) cannot be less than min_amount ({rule.min_amount}).",
        )

    if "approver_role" in payload and payload["approver_role"]:
        rule.approver_role = str(payload["approver_role"]).strip().lower()

    if "requires_approval" in payload and payload["requires_approval"] is not None:
        rule.requires_approval = bool(payload["requires_approval"])

    if "is_active" in payload and payload["is_active"] is not None:
        rule.is_active = bool(payload["is_active"])

    new_value = {
        "min_amount": float(rule.min_amount),
        "max_amount": float(rule.max_amount) if rule.max_amount is not None else None,
        "approver_role": rule.approver_role,
        "requires_approval": rule.requires_approval,
        "is_active": rule.is_active,
    }

    await db.flush()

    await log_event(
        user_id=user_id,
        event_type=AuditEventType.APPROVAL_RULE_UPDATED,
        entity_type="approval_rule",
        entity_id=rule.id,
        previous_value=previous_value,
        new_value=new_value,
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return rule


async def delete_approval_rule(
    rule_id: Union[uuid.UUID, str],
    user_id: Optional[Union[uuid.UUID, str]],
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> bool:
    """
    Deactivates or removes an approval rule with audit logging.

    Args:
        rule_id: Target rule UUID.
        user_id: Actor UUID performing deletion.
        db: Active AsyncSession database session.
        ip: Client IP address.
        user_agent: Client user-agent string.

    Returns:
        True upon successful deletion.

    Raises:
        HTTPException: 404 Not Found if rule doesn't exist.
    """
    parsed_id = rule_id if isinstance(rule_id, uuid.UUID) else uuid.UUID(str(rule_id))

    rule = await db.get(ApprovalRule, parsed_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ApprovalRule with ID '{parsed_id}' not found.",
        )

    prev_state = {
        "company_id": str(rule.company_id),
        "min_amount": float(rule.min_amount),
        "max_amount": float(rule.max_amount) if rule.max_amount is not None else None,
        "approver_role": rule.approver_role,
    }

    # Delete rule
    await db.delete(rule)
    await db.flush()

    await log_event(
        user_id=user_id,
        event_type=AuditEventType.APPROVAL_RULE_DELETED,
        entity_type="approval_rule",
        entity_id=parsed_id,
        previous_value=prev_state,
        new_value={"action": "deleted"},
        ip=ip,
        user_agent=user_agent,
        db=db,
    )

    return True


async def get_approval_rules(
    company_id: Union[uuid.UUID, str],
    db: AsyncSession,
) -> List[ApprovalRule]:
    """
    Returns all active approval rules configured for a specific company ordered by lower threshold.

    Args:
        company_id: Target company UUID.
        db: Active AsyncSession database session.

    Returns:
        List of ApprovalRule instances.
    """
    parsed_cid = company_id if isinstance(company_id, uuid.UUID) else uuid.UUID(str(company_id))

    stmt = (
        select(ApprovalRule)
        .where(
            ApprovalRule.company_id == parsed_cid,
            ApprovalRule.is_active.is_(True),
        )
        .order_by(ApprovalRule.min_amount.asc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_applicable_rule(
    company_id: Union[uuid.UUID, str],
    amount: Union[Decimal, float, int],
    db: AsyncSession,
) -> Optional[ApprovalRule]:
    """
    Evaluates the approval matrix for a given company and payment amount.
    Returns the most specific rule governing the payment tier.

    Args:
        company_id: Associated company UUID.
        amount: Total payout amount.
        db: Active AsyncSession database session.

    Returns:
        Matching ApprovalRule model instance or None.
    """
    parsed_cid = company_id if isinstance(company_id, uuid.UUID) else uuid.UUID(str(company_id))
    dec_amount = Decimal(str(amount))

    # Query active rules where min_amount <= amount and (max_amount is None or amount <= max_amount)
    stmt = (
        select(ApprovalRule)
        .where(
            ApprovalRule.company_id == parsed_cid,
            ApprovalRule.is_active.is_(True),
            ApprovalRule.min_amount <= dec_amount,
            (ApprovalRule.max_amount.is_(None)) | (ApprovalRule.max_amount >= dec_amount),
        )
        .order_by(ApprovalRule.min_amount.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().first()

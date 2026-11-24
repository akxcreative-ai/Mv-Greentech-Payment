"""
System Settings and Approval Rule Pydantic schemas for MV Payment Approval System.
Manages global runtime configurations and company tiered financial approval authority matrices.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.common import PaginatedResponse
from app.schemas.company import CompanySummary


class SystemSettingBase(BaseModel):
    """Base system setting attributes."""
    model_config = ConfigDict(str_strip_whitespace=True)

    key: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Configuration key identifier (e.g. SMTP_HOST, INVOICE_AUTO_EXPIRE_DAYS)",
    )
    value: Any = Field(
        ...,
        description="Configuration value stored as JSON (supports strings, numbers, lists, objects)",
    )
    description: Optional[str] = Field(
        default=None,
        description="Human-readable description of what this setting controls",
    )


class SystemSettingCreate(SystemSettingBase):
    """Schema for adding a new configuration parameter."""
    pass


class SystemSettingUpdate(BaseModel):
    """
    Schema for updating an existing configuration parameter value.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    value: Any = Field(
        ...,
        description="New configuration value (JSON serializable)",
    )
    description: Optional[str] = Field(
        default=None,
        description="Optional updated setting explanation",
    )


class SystemSettingResponse(BaseModel):
    """
    Response schema returning a configuration setting.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="System setting unique identifier")
    key: str = Field(..., description="Configuration key name")
    value: Any = Field(..., description="Configuration value")
    description: Optional[str] = Field(default=None, description="Setting description")
    updated_by_id: Optional[uuid.UUID] = Field(default=None, description="User UUID who last updated this setting")
    updated_at: datetime = Field(..., description="Last modification timestamp")


class ApprovalRuleBase(BaseModel):
    """Base approval rule matrix attributes."""
    model_config = ConfigDict(str_strip_whitespace=True)

    min_amount: Decimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0.00"),
        decimal_places=2,
        description="Lower monetary boundary for this approval threshold",
    )
    max_amount: Optional[Decimal] = Field(
        default=None,
        ge=Decimal("0.00"),
        decimal_places=2,
        description="Upper monetary boundary (None represents unbounded / infinity)",
    )
    requires_approval: bool = Field(
        default=True,
        description="Whether payment requests in this range require formal approval",
    )
    approver_role: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Required role authorized to approve this tier (e.g. department_head, director)",
    )
    is_active: bool = Field(
        default=True,
        description="Whether this rule is actively enforced",
    )

    @model_validator(mode="after")
    def validate_amount_range(self) -> "ApprovalRuleBase":
        """Ensure max_amount is greater than or equal to min_amount when specified."""
        if self.max_amount is not None:
            if self.max_amount < self.min_amount:
                raise ValueError(
                    f"max_amount ({self.max_amount}) cannot be less than min_amount ({self.min_amount})."
                )
        return self


class ApprovalRuleCreate(ApprovalRuleBase):
    """
    Schema for creating a company-specific approval threshold rule.
    """
    company_id: uuid.UUID = Field(
        ...,
        description="Operating company UUID to which this threshold matrix applies",
    )


class ApprovalRuleUpdate(BaseModel):
    """
    Schema for updating an existing approval rule.
    All attributes are optional.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    min_amount: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"), decimal_places=2)
    max_amount: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"), decimal_places=2)
    requires_approval: Optional[bool] = Field(default=None)
    approver_role: Optional[str] = Field(default=None, min_length=2, max_length=50)
    is_active: Optional[bool] = Field(default=None)

    @model_validator(mode="after")
    def validate_amount_range(self) -> "ApprovalRuleUpdate":
        if self.min_amount is not None and self.max_amount is not None:
            if self.max_amount < self.min_amount:
                raise ValueError("max_amount cannot be less than min_amount.")
        return self


class ApprovalRuleResponse(BaseModel):
    """
    Response schema returning complete approval rule matrix details.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Approval rule unique identifier")
    company_id: uuid.UUID = Field(..., description="Operating company UUID")
    company: Optional[CompanySummary] = Field(default=None, description="Associated company summary")
    min_amount: Decimal = Field(..., description="Lower monetary threshold")
    max_amount: Optional[Decimal] = Field(default=None, description="Upper monetary threshold")
    requires_approval: bool = Field(..., description="Approval requirement flag")
    approver_role: str = Field(..., description="Authorized approver role")
    is_active: bool = Field(..., description="Rule active status")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class ApprovalRuleListResponse(PaginatedResponse[ApprovalRuleResponse]):
    """Paginated collection of approval rules."""
    pass

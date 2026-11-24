"""
Department Pydantic schemas for MV Payment Approval System.
Handles department hierarchy, head assignment, company linkage, and lifecycle states.
"""

from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import PaginatedResponse
from app.schemas.company import CompanySummary


class DepartmentHeadSummary(BaseModel):
    """Compact user profile for department heads."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="User unique identifier")
    email: str = Field(..., description="User email address")
    first_name: str = Field(..., description="First name")
    last_name: str = Field(..., description="Last name")
    full_name: str = Field(..., description="Full name of department head")


class DepartmentBase(BaseModel):
    """Base department attributes."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Department name (e.g. Accounts, Operations, Engineering)",
    )
    code: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Department code unique within company (e.g. ACC, OPS)",
    )

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        """Ensure department code is uppercase and trimmed."""
        return v.strip().upper()


class DepartmentCreate(DepartmentBase):
    """
    Schema for creating a new department under a specific company.
    """
    company_id: uuid.UUID = Field(
        ...,
        description="Foreign key UUID of the parent company",
    )
    head_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Optional User UUID of the designated department head",
    )
    is_active: bool = Field(
        default=True,
        description="Initial active status",
    )


class DepartmentUpdate(BaseModel):
    """
    Schema for modifying department attributes.
    All attributes are optional.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=100,
        description="Updated department name",
    )
    code: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=50,
        description="Updated department code",
    )
    company_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Updated parent company UUID",
    )
    head_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Updated head of department User UUID",
    )
    is_active: Optional[bool] = Field(
        default=None,
        description="Updated active status flag",
    )

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return v.strip().upper()


class DepartmentSummary(BaseModel):
    """
    Compact department summary for embedding in user, vendor, or payment request schemas.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Department unique identifier")
    name: str = Field(..., description="Department name")
    code: str = Field(..., description="Department code")
    company_id: uuid.UUID = Field(..., description="Parent company UUID")


class DepartmentResponse(DepartmentBase):
    """
    Comprehensive department schema returned to clients.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Department unique identifier")
    company_id: uuid.UUID = Field(..., description="Associated company UUID")
    head_id: Optional[uuid.UUID] = Field(default=None, description="Department head User UUID")
    is_active: bool = Field(..., description="Active status flag")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Last modification timestamp")

    # Nested relations
    company: Optional[CompanySummary] = Field(default=None, description="Parent company details")
    head: Optional[DepartmentHeadSummary] = Field(default=None, description="Department head user details")


class DepartmentListResponse(PaginatedResponse[DepartmentResponse]):
    """Paginated list of departments."""
    pass

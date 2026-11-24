"""
User and Role Pydantic schemas for MV Payment Approval System.
Handles user registration, profile updates, role authorization levels, and directory listings.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.common import PaginatedResponse
from app.schemas.company import CompanySummary
from app.schemas.department import DepartmentSummary


class RoleBase(BaseModel):
    """Base role definition attributes."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Role identifier (e.g. super_admin, director, accountant, department_head)",
    )
    display_name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="User-friendly role display label",
    )
    description: Optional[str] = Field(
        default=None,
        description="Scope of authority and responsibility",
    )
    permissions: Dict[str, Any] = Field(
        default_factory=dict,
        description="Granular permission flags across system modules",
    )


class RoleCreate(RoleBase):
    """Schema for creating a custom organizational role."""
    is_system_role: bool = Field(
        default=False,
        description="True if system-protected role",
    )


class RoleUpdate(BaseModel):
    """Schema for updating role permissions or display name."""
    model_config = ConfigDict(str_strip_whitespace=True)

    display_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = Field(default=None)
    permissions: Optional[Dict[str, Any]] = Field(default=None)


class RoleResponse(RoleBase):
    """Role response model."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Role unique identifier")
    is_system_role: bool = Field(..., description="Whether this is a protected system role")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Modification timestamp")


class UserSummary(BaseModel):
    """
    Compact user identity representation for embedding across all system objects.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="User unique identifier")
    email: EmailStr = Field(..., description="Email address")
    first_name: str = Field(..., description="First name")
    last_name: str = Field(..., description="Last name")
    full_name: str = Field(..., description="Full combined name")
    avatar_url: Optional[str] = Field(default=None, description="Profile avatar URL")
    role_name: Optional[str] = Field(default=None, description="Role identifier code")


class UserBase(BaseModel):
    """Base attributes common to user models."""
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr = Field(
        ...,
        description="User primary login email address",
    )
    first_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="User given name",
    )
    last_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="User family or surname",
    )
    phone: Optional[str] = Field(
        default=None,
        max_length=20,
        description="Contact telephone or mobile number",
    )

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        """Store email in lowercase for consistency."""
        return v.strip().lower()


class UserCreate(UserBase):
    """
    Schema for provisioning a new user account.
    """
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Plain text password (minimum 8 characters)",
    )
    role_id: uuid.UUID = Field(
        ...,
        description="Foreign key UUID of the assigned system role",
    )
    department_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Foreign key UUID of the associated department",
    )
    company_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Foreign key UUID of the associated company",
    )
    avatar_url: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional profile image URL",
    )

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Enforce basic password complexity requirements."""
        if len(v) < 8:
            raise ValueError("Password must contain at least 8 characters.")
        return v


class UserUpdate(BaseModel):
    """
    Schema for updating user details.
    All attributes are optional.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    first_name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
        description="Updated first name",
    )
    last_name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
        description="Updated last name",
    )
    role_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Updated role UUID",
    )
    department_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Updated department UUID",
    )
    company_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Updated company UUID",
    )
    phone: Optional[str] = Field(
        default=None,
        max_length=20,
        description="Updated contact phone",
    )
    is_active: Optional[bool] = Field(
        default=None,
        description="Updated active account status",
    )
    is_locked: Optional[bool] = Field(
        default=None,
        description="Updated account lock state",
    )
    avatar_url: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Updated profile avatar URL",
    )


class UserResponse(BaseModel):
    """
    User details returned to clients.
    Strictly excludes sensitive fields such as password and password_hash.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="User unique identifier")
    email: EmailStr = Field(..., description="Email address")
    first_name: str = Field(..., description="Given name")
    last_name: str = Field(..., description="Surname")
    full_name: str = Field(..., description="Computed full name")
    role: Optional[RoleResponse] = Field(default=None, description="Assigned role details")
    department: Optional[DepartmentSummary] = Field(default=None, description="Department info")
    company: Optional[CompanySummary] = Field(default=None, description="Company info")
    phone: Optional[str] = Field(default=None, description="Phone number")
    avatar_url: Optional[str] = Field(default=None, description="Avatar image URL")
    is_active: bool = Field(..., description="Whether user account is active")
    is_locked: bool = Field(..., description="Whether user account is security locked")
    last_login: Optional[datetime] = Field(default=None, description="Last login timestamp")
    created_at: datetime = Field(..., description="User creation timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Last update timestamp")


class UserProfile(BaseModel):
    """
    User self-service profile representation.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="User unique identifier")
    email: EmailStr = Field(..., description="Email address")
    first_name: str = Field(..., description="Given name")
    last_name: str = Field(..., description="Surname")
    full_name: str = Field(..., description="Full name")
    role: Optional[RoleResponse] = Field(default=None, description="User role details")
    department: Optional[DepartmentSummary] = Field(default=None, description="Assigned department")
    company: Optional[CompanySummary] = Field(default=None, description="Assigned company")
    phone: Optional[str] = Field(default=None, description="Phone number")
    avatar_url: Optional[str] = Field(default=None, description="Profile photo URL")


class UserListResponse(PaginatedResponse[UserResponse]):
    """Paginated collection of user accounts."""
    pass

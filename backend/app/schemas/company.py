"""
Company Pydantic schemas for MV Payment Approval System.
Handles multi-entity company creation, updates, responses, and branding settings.
"""

from datetime import datetime
import re
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.common import PaginatedResponse


class CompanyBase(BaseModel):
    """Base company properties shared across multiple schemas."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Company registered legal or trade name",
    )
    code: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Unique identifier code for the company (e.g. MV-CORP)",
    )
    address: Optional[str] = Field(
        default=None,
        description="Corporate registered office address",
    )
    phone: Optional[str] = Field(
        default=None,
        max_length=20,
        description="Official contact phone number",
    )
    email: Optional[EmailStr] = Field(
        default=None,
        description="Official contact email address",
    )
    gst_number: Optional[str] = Field(
        default=None,
        max_length=15,
        description="15-character Goods and Services Tax Identification Number (GSTIN)",
    )
    pan_number: Optional[str] = Field(
        default=None,
        max_length=10,
        description="10-character Permanent Account Number (PAN)",
    )
    primary_color: Optional[str] = Field(
        default="#1E40AF",
        max_length=20,
        description="Primary brand hex color code (e.g. #1E40AF)",
    )
    secondary_color: Optional[str] = Field(
        default="#3B82F6",
        max_length=20,
        description="Secondary brand hex color code (e.g. #3B82F6)",
    )

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        """Ensure company code is upper-case and trimmed."""
        return v.strip().upper()

    @field_validator("gst_number")
    @classmethod
    def validate_gst(cls, v: Optional[str]) -> Optional[str]:
        """Validate and format GSTIN if provided."""
        if v is None:
            return None
        v = v.strip().upper()
        if v and not re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", v):
            raise ValueError("Invalid Indian GSTIN format. Expected 15-character alphanumeric format.")
        return v

    @field_validator("pan_number")
    @classmethod
    def validate_pan(cls, v: Optional[str]) -> Optional[str]:
        """Validate and format PAN if provided."""
        if v is None:
            return None
        v = v.strip().upper()
        if v and not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", v):
            raise ValueError("Invalid Indian PAN format. Expected 10-character alphanumeric format.")
        return v

    @field_validator("primary_color", "secondary_color")
    @classmethod
    def validate_hex_color(cls, v: Optional[str]) -> Optional[str]:
        """Validate hex color code format."""
        if v is None:
            return None
        v = v.strip()
        if not re.match(r"^#(?:[0-9a-fA-F]{3}){1,2}$", v):
            raise ValueError(f"Invalid hex color format: '{v}'. Must be #RGB or #RRGGBB.")
        return v


class CompanyCreate(CompanyBase):
    """
    Schema for registering a new operating company entity.
    """
    logo_url: Optional[str] = Field(
        default=None,
        max_length=500,
        description="URL path or storage location of company logo",
    )
    is_active: bool = Field(
        default=True,
        description="Whether company is active upon creation",
    )


class CompanyUpdate(BaseModel):
    """
    Schema for updating an existing company entity.
    All attributes are optional.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=255,
        description="Updated company name",
    )
    code: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=50,
        description="Updated unique company code",
    )
    address: Optional[str] = Field(
        default=None,
        description="Updated corporate address",
    )
    phone: Optional[str] = Field(
        default=None,
        max_length=20,
        description="Updated contact phone",
    )
    email: Optional[EmailStr] = Field(
        default=None,
        description="Updated contact email",
    )
    gst_number: Optional[str] = Field(
        default=None,
        max_length=15,
        description="Updated GSTIN",
    )
    pan_number: Optional[str] = Field(
        default=None,
        max_length=10,
        description="Updated PAN",
    )
    logo_url: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Updated logo image URL",
    )
    primary_color: Optional[str] = Field(
        default=None,
        max_length=20,
        description="Updated primary brand hex color",
    )
    secondary_color: Optional[str] = Field(
        default=None,
        max_length=20,
        description="Updated secondary brand hex color",
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

    @field_validator("gst_number")
    @classmethod
    def validate_gst(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip().upper()
        if v and not re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", v):
            raise ValueError("Invalid Indian GSTIN format. Expected 15-character alphanumeric format.")
        return v

    @field_validator("pan_number")
    @classmethod
    def validate_pan(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip().upper()
        if v and not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", v):
            raise ValueError("Invalid Indian PAN format. Expected 10-character alphanumeric format.")
        return v

    @field_validator("primary_color", "secondary_color")
    @classmethod
    def validate_hex_color(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not re.match(r"^#(?:[0-9a-fA-F]{3}){1,2}$", v):
            raise ValueError(f"Invalid hex color format: '{v}'. Must be #RGB or #RRGGBB.")
        return v


class CompanySummary(BaseModel):
    """
    Compact company reference for embedding within other responses.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Company unique identifier")
    name: str = Field(..., description="Company name")
    code: str = Field(..., description="Company code")
    logo_url: Optional[str] = Field(default=None, description="Company logo URL")
    primary_color: Optional[str] = Field(default=None, description="Primary brand color")


class CompanyResponse(CompanyBase):
    """
    Complete company response schema including audit metadata and system identifiers.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Company unique identifier")
    logo_url: Optional[str] = Field(default=None, description="Logo URL path")
    is_active: bool = Field(..., description="Active status flag")
    created_at: datetime = Field(..., description="Entity creation timestamp")
    updated_at: datetime = Field(..., description="Last modification timestamp")


class CompanyListResponse(PaginatedResponse[CompanyResponse]):
    """Paginated list of companies."""
    pass

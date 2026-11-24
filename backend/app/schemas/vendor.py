"""
Vendor Pydantic schemas for MV Payment Approval System.
Handles supplier registry, corporate tax information, banking disbursement coordinates, and access control.
"""

from datetime import datetime
import re
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.common import PaginatedResponse
from app.schemas.company import CompanySummary


class VendorBankDetails(BaseModel):
    """
    Restricted vendor banking disbursement coordinates.
    Access restricted to accountants, approvers, and administrative roles.
    """
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    bank_name: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Beneficiary financial institution name",
    )
    bank_account_number: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Vendor bank account number",
    )
    bank_ifsc: Optional[str] = Field(
        default=None,
        max_length=20,
        description="Indian Financial System Code (IFSC)",
    )
    bank_branch: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Bank branch location name",
    )

    @field_validator("bank_ifsc")
    @classmethod
    def validate_ifsc(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip().upper()
        if v and not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", v):
            raise ValueError("Invalid Indian IFSC code format. Expected 11 characters (e.g. HDFC0001234).")
        return v


class VendorBase(BaseModel):
    """Base vendor attributes."""
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Vendor legal trade or business name",
    )
    code: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Vendor identifier unique within the company",
    )
    contact_person: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Primary liaison or representative name",
    )
    email: Optional[EmailStr] = Field(
        default=None,
        description="Official email for invoicing notifications",
    )
    phone: Optional[str] = Field(
        default=None,
        max_length=20,
        description="Contact phone or mobile number",
    )
    address: Optional[str] = Field(
        default=None,
        description="Registered supplier office or billing address",
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

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("gst_number")
    @classmethod
    def validate_gst(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip().upper()
        if v and not re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", v):
            raise ValueError("Invalid Indian GSTIN format.")
        return v

    @field_validator("pan_number")
    @classmethod
    def validate_pan(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip().upper()
        if v and not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", v):
            raise ValueError("Invalid Indian PAN format.")
        return v


class VendorCreate(VendorBase):
    """
    Schema for registering a new vendor.
    Includes initial banking disbursement details.
    """
    company_id: uuid.UUID = Field(
        ...,
        description="Foreign key UUID of the operating company",
    )
    bank_name: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Beneficiary bank name",
    )
    bank_account_number: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Bank account number",
    )
    bank_ifsc: Optional[str] = Field(
        default=None,
        max_length=20,
        description="Bank IFSC code",
    )
    bank_branch: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Bank branch name",
    )
    is_active: bool = Field(
        default=True,
        description="Vendor initial active status",
    )

    @field_validator("bank_ifsc")
    @classmethod
    def validate_ifsc(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip().upper()
        if v and not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", v):
            raise ValueError("Invalid Indian IFSC code format.")
        return v


class VendorUpdate(BaseModel):
    """
    Schema for updating vendor profile and payment details.
    All attributes are optional.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    code: Optional[str] = Field(default=None, min_length=2, max_length=50)
    company_id: Optional[uuid.UUID] = Field(default=None)
    contact_person: Optional[str] = Field(default=None, max_length=100)
    email: Optional[EmailStr] = Field(default=None)
    phone: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = Field(default=None)
    gst_number: Optional[str] = Field(default=None, max_length=15)
    pan_number: Optional[str] = Field(default=None, max_length=10)
    bank_name: Optional[str] = Field(default=None, max_length=100)
    bank_account_number: Optional[str] = Field(default=None, max_length=50)
    bank_ifsc: Optional[str] = Field(default=None, max_length=20)
    bank_branch: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = Field(default=None)

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
            raise ValueError("Invalid Indian GSTIN format.")
        return v

    @field_validator("pan_number")
    @classmethod
    def validate_pan(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip().upper()
        if v and not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", v):
            raise ValueError("Invalid Indian PAN format.")
        return v

    @field_validator("bank_ifsc")
    @classmethod
    def validate_ifsc(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip().upper()
        if v and not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", v):
            raise ValueError("Invalid Indian IFSC code format.")
        return v


class VendorSummary(BaseModel):
    """
    Compact summary of vendor details for embedding in payment requests.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Vendor unique identifier")
    name: str = Field(..., description="Vendor name")
    code: str = Field(..., description="Vendor code")
    email: Optional[EmailStr] = Field(default=None, description="Contact email")
    phone: Optional[str] = Field(default=None, description="Contact phone")
    gst_number: Optional[str] = Field(default=None, description="GSTIN")


class VendorResponse(VendorBase):
    """
    Vendor response schema.
    Contains profile, tax, company link, and full/masked bank details.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Vendor unique identifier")
    company_id: uuid.UUID = Field(..., description="Parent company UUID")
    company: Optional[CompanySummary] = Field(default=None, description="Parent company details")
    bank_name: Optional[str] = Field(default=None, description="Bank name")
    bank_account_number: Optional[str] = Field(default=None, description="Bank account number")
    bank_ifsc: Optional[str] = Field(default=None, description="Bank IFSC")
    bank_branch: Optional[str] = Field(default=None, description="Bank branch")
    is_active: bool = Field(..., description="Active status")
    created_at: datetime = Field(..., description="Created timestamp")
    updated_at: datetime = Field(..., description="Last updated timestamp")

    @property
    def bank_details(self) -> Optional[VendorBankDetails]:
        """Convenience property packaging banking fields into VendorBankDetails."""
        if any([self.bank_name, self.bank_account_number, self.bank_ifsc, self.bank_branch]):
            return VendorBankDetails(
                bank_name=self.bank_name,
                bank_account_number=self.bank_account_number,
                bank_ifsc=self.bank_ifsc,
                bank_branch=self.bank_branch,
            )
        return None


class VendorListResponse(PaginatedResponse[VendorResponse]):
    """Paginated collection of vendors."""
    pass

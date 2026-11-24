"""
Company model for MV Payment Approval System.
Represents organization/entity in a multi-company enterprise structure.
"""

from typing import TYPE_CHECKING, List, Optional
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, JSON, Numeric, String, Text
from app.models.base import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.payment_request import PaymentRequest
    from app.models.settings import ApprovalRule
    from app.models.user import User
    from app.models.vendor import Vendor


class Company(Base, UUIDMixin, TimestampMixin):
    """
    Company entity representing an operating business entity.
    """
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Company registered legal or trade name",
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique identifier code for the company (e.g. MV-CORP)",
    )
    address: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Registered corporate address",
    )
    phone: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Official contact phone number",
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Official contact email address",
    )
    gst_number: Mapped[Optional[str]] = mapped_column(
        String(15),
        nullable=True,
        index=True,
        comment="Goods and Services Tax Identification Number (GSTIN)",
    )
    pan_number: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
        index=True,
        comment="Permanent Account Number (PAN)",
    )
    logo_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="URL path to company logo image",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Flag indicating if company is currently active",
    )
    primary_color: Mapped[Optional[str]] = mapped_column(
        String(20),
        default="#1E40AF",
        nullable=True,
        comment="Primary branding hex color code",
    )
    secondary_color: Mapped[Optional[str]] = mapped_column(
        String(20),
        default="#3B82F6",
        nullable=True,
        comment="Secondary branding hex color code",
    )

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="company",
    )
    departments: Mapped[List["Department"]] = relationship(
        "Department",
        back_populates="company",
        cascade="all, delete-orphan",
    )
    vendors: Mapped[List["Vendor"]] = relationship(
        "Vendor",
        back_populates="company",
        cascade="all, delete-orphan",
    )
    payment_requests: Mapped[List["PaymentRequest"]] = relationship(
        "PaymentRequest",
        back_populates="company",
    )
    approval_rules: Mapped[List["ApprovalRule"]] = relationship(
        "ApprovalRule",
        back_populates="company",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Company(id={self.id}, code='{self.code}', name='{self.name}')>"

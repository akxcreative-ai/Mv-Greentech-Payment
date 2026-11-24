"""
Vendor model for MV Payment Approval System.
Stores vendor/supplier master records, tax IDs, and bank disbursement details.
"""

from typing import TYPE_CHECKING, List, Optional
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, JSON, Numeric, String, Text, UniqueConstraint
from app.models.base import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.payment_request import PaymentRequest


class Vendor(BaseModel):
    """
    Vendor entity representing suppliers, contractors, and service providers.
    """
    __tablename__ = "vendors"
    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_vendor_company_code"),
        Index("ix_vendor_company_name", "company_id", "name"),
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Vendor legal business name",
    )
    code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Vendor unique code within the company",
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Associated company entity",
    )
    contact_person: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Primary point of contact name",
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Official email address for invoices and communications",
    )
    phone: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Contact phone number",
    )
    address: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Vendor physical / billing address",
    )
    gst_number: Mapped[Optional[str]] = mapped_column(
        String(15),
        nullable=True,
        index=True,
        comment="Vendor GSTIN (Goods and Services Tax Number)",
    )
    pan_number: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
        index=True,
        comment="Vendor PAN (Permanent Account Number)",
    )
    bank_name: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Beneficiary bank name",
    )
    bank_account_number: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Beneficiary bank account number",
    )
    bank_ifsc: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Bank IFSC code for electronic funds transfer",
    )
    bank_branch: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Bank branch name or location",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Active status flag",
    )

    # Relationships
    company: Mapped["Company"] = relationship(
        "Company",
        back_populates="vendors",
    )
    payment_requests: Mapped[List["PaymentRequest"]] = relationship(
        "PaymentRequest",
        back_populates="vendor",
    )

    def __repr__(self) -> str:
        return f"<Vendor(id={self.id}, code='{self.code}', name='{self.name}')>"

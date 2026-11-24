"""
PaymentRecord Pydantic schemas for MV Payment Approval System.
Handles disbursement execution logging, banking references, UTR tracking, and payment verification.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from app.models.payment_request import PaymentMode
from app.schemas.common import PaginatedResponse
from app.schemas.user import UserSummary


class PaymentRecordBase(BaseModel):
    """Base payment disbursement execution attributes."""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        populate_by_name=True,
        from_attributes=True,
    )

    payment_date: Optional[datetime] = Field(
        default=None,
        description="Effective date and time the disbursement took place",
    )
    actual_amount: Decimal = Field(
        ...,
        gt=Decimal("0.00"),
        decimal_places=2,
        description="Actual net disbursed amount (accounting for TDS or other deductions)",
    )
    payment_mode: PaymentMode = Field(
        ...,
        description="Disbursement channel: NEFT, RTGS, IMPS, UPI, CHEQUE, CASH, or OTHER",
    )
    bank_account: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Disbursing company bank account number or identifier",
    )
    transaction_id: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Internal banking transaction identifier",
    )
    utr_number: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Unique Transaction Reference (UTR) from bank statement",
    )
    cheque_number: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Cheque serial number if paid via physical cheque",
    )
    reference: Optional[str] = Field(
        default=None,
        max_length=100,
        alias="payment_reference",
        description="ERP voucher reference or general ledger entry identifier",
    )
    remarks: Optional[str] = Field(
        default=None,
        max_length=1000,
        alias="payment_remarks",
        description="Accountant execution notes and deductions breakdown",
    )
    proof_document_id: Optional[uuid.UUID] = Field(
        default=None,
        description="UUID of uploaded bank debit advice or payment acknowledgement receipt",
    )

    @field_validator("utr_number", "transaction_id", "cheque_number", "reference", "remarks")
    @classmethod
    def clean_references(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        return v if v else None


class PaymentRecordCreate(PaymentRecordBase):
    """
    Schema for recording payment disbursement by an accountant.
    Fields: payment_date, actual_amount, payment_mode, bank_account, transaction_id,
            utr_number, cheque_number, reference, remarks, proof_document_id.
    """

    @property
    def payment_reference(self) -> Optional[str]:
        return self.reference

    @property
    def payment_remarks(self) -> Optional[str]:
        return self.remarks

    @model_validator(mode="after")
    def validate_payment_identifiers(self) -> "PaymentRecordCreate":
        """Verify that relevant reference is provided based on the payment mode."""
        if self.payment_mode in (PaymentMode.NEFT, PaymentMode.RTGS, PaymentMode.IMPS):
            if not self.utr_number and not self.transaction_id:
                # In banking workflows, either UTR or transaction ID is strongly expected
                pass
        elif self.payment_mode == PaymentMode.CHEQUE:
            if not self.cheque_number:
                raise ValueError("Cheque number is required when payment mode is CHEQUE.")
        return self


class PaymentRecordResponse(PaymentRecordBase):
    """
    Response schema returning complete disbursement record and accountant details.
    """
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID = Field(..., description="Payment record unique identifier")
    payment_request_id: uuid.UUID = Field(..., description="Target payment request UUID")
    paid_by_id: uuid.UUID = Field(..., description="Accountant user UUID who recorded disbursement")
    paid_by: Optional[UserSummary] = Field(
        default=None,
        description="User details of the accountant who executed the disbursement",
    )
    payment_date: datetime = Field(
        ...,
        description="Effective date and time the payment occurred",
    )
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Last modification timestamp")

    @computed_field
    @property
    def payment_reference(self) -> Optional[str]:
        """Alias property for backward compatibility with existing API clients."""
        return self.reference

    @computed_field
    @property
    def payment_remarks(self) -> Optional[str]:
        """Alias property for backward compatibility with existing API clients."""
        return self.remarks


class PaymentRecordListResponse(PaginatedResponse[PaymentRecordResponse]):
    """Paginated collection of payment execution records."""
    pass

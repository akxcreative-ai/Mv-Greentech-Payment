"""
PaymentRecord model for MV Payment Approval System.
Stores execution data, UTR / transaction IDs, and bank disbursement confirmations.
"""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
)
from app.models.base import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.payment_request import PaymentMode

if TYPE_CHECKING:
    from app.models.document import PaymentRequestDocument
    from app.models.payment_request import PaymentRequest
    from app.models.user import User


class PaymentRecord(Base, UUIDMixin, TimestampMixin):
    """
    Execution record created by accountants upon executing actual payment disbursement.
    """
    __tablename__ = "payment_records"
    __table_args__ = (
        Index("ix_payment_records_utr", "utr_number"),
        Index("ix_payment_records_transaction", "transaction_id"),
        Index("ix_payment_records_request_date", "payment_request_id", "payment_date"),
    )

    payment_request_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("payment_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Associated approved payment request",
    )
    paid_by_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Accountant or finance executive who recorded the disbursement",
    )
    payment_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="Effective date and time the payment occurred",
    )
    actual_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        nullable=False,
        comment="Actual net disbursed amount (accounting for any deductions/TDS)",
    )
    payment_mode: Mapped[PaymentMode] = mapped_column(
        SAEnum(PaymentMode, name="payment_record_mode_enum"),
        nullable=False,
        comment="Actual channel used for disbursement (e.g. NEFT, RTGS, CHEQUE)",
    )
    bank_account: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Disbursing company bank account number or identifier",
    )
    transaction_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Internal banking transaction identifier",
    )
    utr_number: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Unique Transaction Reference (UTR) from bank statement",
    )
    cheque_number: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Cheque serial number if paid via physical cheque",
    )
    payment_reference: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="External ERP reference or voucher number",
    )
    payment_remarks: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Accountant payment notes and observations",
    )
    proof_document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("payment_request_documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Uploaded bank debit advice / receipt confirmation attachment",
    )

    # Relationships
    payment_request: Mapped["PaymentRequest"] = relationship(
        "PaymentRequest",
        back_populates="payment_records",
    )
    paid_by: Mapped["User"] = relationship(
        "User",
        foreign_keys=[paid_by_id],
        back_populates="payment_records",
    )
    proof_document: Mapped[Optional["PaymentRequestDocument"]] = relationship(
        "PaymentRequestDocument",
        foreign_keys=[proof_document_id],
        back_populates="payment_records",
    )

    def __repr__(self) -> str:
        return f"<PaymentRecord(id={self.id}, request_id={self.payment_request_id}, amount={self.actual_amount}, utr='{self.utr_number}')>"

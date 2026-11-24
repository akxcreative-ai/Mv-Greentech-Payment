"""
Document model for MV Payment Approval System.
Stores metadata for uploaded invoices, purchase orders, quotes, receipts, and payment proofs.
"""

from typing import TYPE_CHECKING, List, Optional
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, JSON, Numeric, String, Text
from app.models.base import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimeCreatedMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.payment_record import PaymentRecord
    from app.models.payment_request import PaymentRequest
    from app.models.user import User


class PaymentRequestDocument(Base, UUIDMixin, TimeCreatedMixin, SoftDeleteMixin):
    """
    Supporting attachments and documentation linked to a payment request.
    """
    __tablename__ = "payment_request_documents"

    payment_request_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("payment_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Parent payment request this document supports",
    )
    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="System storage filename (e.g. hashed or UUID filename)",
    )
    original_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Original uploaded filename as provided by user",
    )
    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Relative or absolute filesystem/object store path",
    )
    file_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="File size in bytes",
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="MIME type of uploaded asset (e.g. application/pdf, image/jpeg)",
    )
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="User who uploaded this file",
    )

    # Relationships
    payment_request: Mapped["PaymentRequest"] = relationship(
        "PaymentRequest",
        back_populates="documents",
    )
    uploaded_by: Mapped["User"] = relationship(
        "User",
        foreign_keys=[uploaded_by_id],
        back_populates="uploaded_documents",
    )
    payment_records: Mapped[List["PaymentRecord"]] = relationship(
        "PaymentRecord",
        foreign_keys="PaymentRecord.proof_document_id",
        back_populates="proof_document",
    )

    def __repr__(self) -> str:
        return f"<PaymentRequestDocument(id={self.id}, file_name='{self.file_name}', original_name='{self.original_name}')>"

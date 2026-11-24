"""
Department model for MV Payment Approval System.
Represents organizational departments linked to companies and headed by users.
"""

from typing import TYPE_CHECKING, List, Optional
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, JSON, Numeric, String, Text, UniqueConstraint
from app.models.base import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.payment_request import PaymentRequest
    from app.models.user import User


class Department(Base, UUIDMixin, TimestampMixin):
    """
    Department entity within a company.
    """
    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_department_company_code"),
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Department name (e.g. Accounts, Operations, Engineering)",
    )
    code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Department unique code within company (e.g. ACC, OPS, ENG)",
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Foreign key to the parent company",
    )
    head_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL", use_alter=True, name="fk_departments_head_id"),
        nullable=True,
        index=True,
        comment="User ID of the department head",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Whether the department is active",
    )

    # Relationships
    company: Mapped["Company"] = relationship(
        "Company",
        back_populates="departments",
    )
    head: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[head_id],
        back_populates="headed_departments",
    )
    users: Mapped[List["User"]] = relationship(
        "User",
        foreign_keys="User.department_id",
        back_populates="department",
    )
    payment_requests: Mapped[List["PaymentRequest"]] = relationship(
        "PaymentRequest",
        back_populates="department",
    )

    def __repr__(self) -> str:
        return f"<Department(id={self.id}, code='{self.code}', name='{self.name}', company_id={self.company_id})>"

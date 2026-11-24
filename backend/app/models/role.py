"""
Role model for MV Payment Approval System.
Defines user roles, permission sets, and system-defined role restrictions.
"""

from enum import Enum
from typing import TYPE_CHECKING, Any, Dict, List, Optional
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, JSON, Numeric, String, Text
from app.models.base import GUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User


class RoleEnum(str, Enum):
    """Standard system role identifiers."""
    SUPER_ADMIN = "super_admin"
    DIRECTOR = "director"
    ACCOUNTANT = "accountant"
    DEPARTMENT_HEAD = "department_head"


class Role(Base, UUIDMixin, TimestampMixin):
    """
    Role entity defining authorization permissions across the system.
    """
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique role identifier, e.g. super_admin, director, accountant, department_head",
    )
    display_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Human-readable display name, e.g. Department Head",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Description of the role scope and capabilities",
    )
    permissions: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="JSON object defining granular module and action permissions",
    )
    is_system_role: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="True if built-in system role that cannot be deleted or renamed",
    )

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="role",
    )

    def __repr__(self) -> str:
        return f"<Role(id={self.id}, name='{self.name}', display_name='{self.display_name}')>"

"""
Database models package for MV Payment Approval System.
Imports and exports all SQLAlchemy 2.0 declarative models, mixins, and enums.
"""

from app.models.approval import ApprovalRecord, ApprovalStatus, ClarificationMessage
from app.models.audit_log import AuditEventType, AuditLog
from app.models.base import (
    Base,
    BaseModel,
    SoftDeleteMixin,
    TimeCreatedMixin,
    TimestampMixin,
    UUIDMixin,
)
from app.models.company import Company
from app.models.department import Department
from app.models.document import PaymentRequestDocument
from app.models.notification import Notification, NotificationType
from app.models.payment_record import PaymentRecord
from app.models.payment_request import (
    ExpenseCategory,
    PaymentMode,
    PaymentPriority,
    PaymentRequest,
    PaymentStatus,
)
from app.models.role import Role, RoleEnum
from app.models.session import UserSession
from app.models.settings import ApprovalRule, SystemSettings
from app.models.user import User
from app.models.vendor import Vendor

__all__ = [
    # Base and Mixins
    "Base",
    "BaseModel",
    "UUIDMixin",
    "TimestampMixin",
    "TimeCreatedMixin",
    "SoftDeleteMixin",
    # Core Domain Models
    "User",
    "Role",
    "Company",
    "Department",
    "Vendor",
    "PaymentRequest",
    "PaymentRequestDocument",
    "ApprovalRecord",
    "ClarificationMessage",
    "PaymentRecord",
    "Notification",
    "AuditLog",
    "SystemSettings",
    "ApprovalRule",
    "UserSession",
    # Enums
    "RoleEnum",
    "ExpenseCategory",
    "PaymentMode",
    "PaymentPriority",
    "PaymentStatus",
    "ApprovalStatus",
    "NotificationType",
    "AuditEventType",
]

"""
Pydantic Schemas Package for MV Payment Approval System.
Imports and exports all request, response, filter, and pagination data schemas.
"""

from app.schemas.approval import (
    ApprovalAction,
    ApprovalRecordListResponse,
    ApprovalRecordResponse,
    ClarificationCreate,
    ClarificationListResponse,
    ClarificationResponse,
)
from app.schemas.audit import (
    AuditLogFilter,
    AuditLogListResponse,
    AuditLogResponse,
)
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshTokenRequest,
    TokenPayload,
)
from app.schemas.common import (
    ErrorResponse,
    MessageResponse,
    PaginatedResponse,
    PaginationParams,
    SortOrder,
)
from app.schemas.company import (
    CompanyBase,
    CompanyCreate,
    CompanyListResponse,
    CompanyResponse,
    CompanySummary,
    CompanyUpdate,
)
from app.schemas.dashboard import (
    AccountantDashboardStats,
    AdminDashboardStats,
    ApproverDashboardStats,
    CategorySpendItem,
    MonthlyDataPoint,
    ReportFilter,
)
from app.schemas.department import (
    DepartmentBase,
    DepartmentCreate,
    DepartmentHeadSummary,
    DepartmentListResponse,
    DepartmentResponse,
    DepartmentSummary,
    DepartmentUpdate,
)
from app.schemas.document import (
    DocumentUploaderSummary,
    PaymentRequestDocumentBase,
    PaymentRequestDocumentCreate,
    PaymentRequestDocumentListResponse,
    PaymentRequestDocumentResponse,
)
from app.schemas.notification import (
    NotificationCreate,
    NotificationListResponse,
    NotificationMarkReadRequest,
    NotificationResponse,
)
from app.schemas.payment_record import (
    PaymentRecordBase,
    PaymentRecordCreate,
    PaymentRecordListResponse,
    PaymentRecordResponse,
)
from app.schemas.payment_request import (
    PaymentRequestBase,
    PaymentRequestCreate,
    PaymentRequestFilter,
    PaymentRequestListResponse,
    PaymentRequestResponse,
    PaymentRequestUpdate,
)
from app.schemas.settings import (
    ApprovalRuleBase,
    ApprovalRuleCreate,
    ApprovalRuleListResponse,
    ApprovalRuleResponse,
    ApprovalRuleUpdate,
    SystemSettingBase,
    SystemSettingCreate,
    SystemSettingResponse,
    SystemSettingUpdate,
)
from app.schemas.user import (
    RoleBase,
    RoleCreate,
    RoleResponse,
    RoleUpdate,
    UserBase,
    UserCreate,
    UserListResponse,
    UserProfile,
    UserResponse,
    UserSummary,
    UserUpdate,
)
from app.schemas.vendor import (
    VendorBankDetails,
    VendorBase,
    VendorCreate,
    VendorListResponse,
    VendorResponse,
    VendorSummary,
    VendorUpdate,
)

__all__ = [
    # Common
    "PaginationParams",
    "PaginatedResponse",
    "MessageResponse",
    "ErrorResponse",
    "SortOrder",
    # Auth
    "LoginRequest",
    "LoginResponse",
    "TokenPayload",
    "RefreshTokenRequest",
    "PasswordResetRequest",
    "PasswordResetConfirm",
    "ChangePasswordRequest",
    # User & Role
    "RoleBase",
    "RoleCreate",
    "RoleUpdate",
    "RoleResponse",
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserSummary",
    "UserProfile",
    "UserListResponse",
    # Company
    "CompanyBase",
    "CompanyCreate",
    "CompanyUpdate",
    "CompanyResponse",
    "CompanySummary",
    "CompanyListResponse",
    # Department
    "DepartmentBase",
    "DepartmentCreate",
    "DepartmentUpdate",
    "DepartmentResponse",
    "DepartmentSummary",
    "DepartmentHeadSummary",
    "DepartmentListResponse",
    # Vendor
    "VendorBase",
    "VendorCreate",
    "VendorUpdate",
    "VendorResponse",
    "VendorSummary",
    "VendorBankDetails",
    "VendorListResponse",
    # Document
    "DocumentUploaderSummary",
    "PaymentRequestDocumentBase",
    "PaymentRequestDocumentCreate",
    "PaymentRequestDocumentResponse",
    "PaymentRequestDocumentListResponse",
    # Payment Request
    "PaymentRequestBase",
    "PaymentRequestCreate",
    "PaymentRequestUpdate",
    "PaymentRequestResponse",
    "PaymentRequestListResponse",
    "PaymentRequestFilter",
    # Approval
    "ApprovalAction",
    "ApprovalRecordResponse",
    "ApprovalRecordListResponse",
    "ClarificationCreate",
    "ClarificationResponse",
    "ClarificationListResponse",
    # Payment Record
    "PaymentRecordBase",
    "PaymentRecordCreate",
    "PaymentRecordResponse",
    "PaymentRecordListResponse",
    # Notification
    "NotificationCreate",
    "NotificationResponse",
    "NotificationMarkReadRequest",
    "NotificationListResponse",
    # Audit
    "AuditLogResponse",
    "AuditLogFilter",
    "AuditLogListResponse",
    # Settings
    "SystemSettingBase",
    "SystemSettingCreate",
    "SystemSettingUpdate",
    "SystemSettingResponse",
    "ApprovalRuleBase",
    "ApprovalRuleCreate",
    "ApprovalRuleUpdate",
    "ApprovalRuleResponse",
    "ApprovalRuleListResponse",
    # Dashboard
    "MonthlyDataPoint",
    "CategorySpendItem",
    "AdminDashboardStats",
    "ApproverDashboardStats",
    "AccountantDashboardStats",
    "ReportFilter",
]

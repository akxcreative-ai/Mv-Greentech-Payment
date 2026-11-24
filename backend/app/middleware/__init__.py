"""
Middleware Package for MV Payment Approval System.

Exports:
- Authentication & Authorization: get_current_user, get_current_active_user, require_role, RoleChecker, require_permission, extract_token_from_request
- Security & Tracing: SecurityHeadersMiddleware, RequestLoggingMiddleware, get_trusted_hosts
- Rate Limiting: limiter, rate_limit_exceeded_handler, get_client_ip, LOGIN_RATE_LIMIT, API_DEFAULT_RATE_LIMIT
"""

from app.middleware.auth import (
    RoleChecker,
    extract_token_from_request,
    get_current_active_user,
    get_current_user,
    require_permission,
    require_role,
)
from app.middleware.rate_limit import (
    API_DEFAULT_RATE_LIMIT,
    EXPORT_RATE_LIMIT,
    LOGIN_RATE_LIMIT,
    PASSWORD_RESET_RATE_LIMIT,
    UPLOAD_RATE_LIMIT,
    get_client_ip,
    limiter,
    rate_limit_exceeded_handler,
)
from app.middleware.security import (
    RequestLoggingMiddleware,
    SecurityHeadersMiddleware,
    get_trusted_hosts,
)

__all__ = [
    # Auth
    "get_current_user",
    "get_current_active_user",
    "require_role",
    "RoleChecker",
    "require_permission",
    "extract_token_from_request",
    # Security
    "SecurityHeadersMiddleware",
    "RequestLoggingMiddleware",
    "get_trusted_hosts",
    # Rate Limiting
    "limiter",
    "rate_limit_exceeded_handler",
    "get_client_ip",
    "LOGIN_RATE_LIMIT",
    "PASSWORD_RESET_RATE_LIMIT",
    "API_DEFAULT_RATE_LIMIT",
    "UPLOAD_RATE_LIMIT",
    "EXPORT_RATE_LIMIT",
]

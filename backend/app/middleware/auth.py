"""
Authentication and Authorization Middleware & Dependencies.

Provides JWT extraction (from Authorization header or secure cookies),
user identity resolution, role validation, and granular permission checking.
"""

from typing import Any, Callable, List, Optional, Sequence, Union
import uuid

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.role import Role, RoleEnum
from app.models.user import User
from app.utils.security import decode_token

# Optional HTTPBearer scheme so we can fallback gracefully to cookie extraction
security_bearer = HTTPBearer(auto_error=False)


def extract_token_from_request(
    request: Request,
    bearer_credentials: Optional[HTTPAuthorizationCredentials] = None,
) -> Optional[str]:
    """
    Extracts JWT token from Authorization header (Bearer scheme)
    or from secure browser cookies ('access_token' or 'token').
    """
    # 1. Authorization header via HTTPBearer
    if bearer_credentials and bearer_credentials.credentials:
        return bearer_credentials.credentials.strip()

    # 2. Raw Authorization header fallback
    auth_header = request.headers.get("Authorization")
    if auth_header:
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1].strip()

    # 3. Secure HTTP cookie fallback
    cookie_token = request.cookies.get("access_token") or request.cookies.get("token")
    if cookie_token:
        # Strip potential 'Bearer ' prefix if stored with it
        if cookie_token.startswith("Bearer "):
            return cookie_token[7:].strip()
        return cookie_token.strip()

    return None


async def get_current_user(
    request: Request,
    bearer_credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependency that extracts JWT from header or cookie, decodes and verifies it,
    and returns the active User object with loaded Role.

    Raises:
        HTTPException 401: If token is missing, invalid, or expired.
        HTTPException 403: If user account is inactive or locked.
    """
    token = extract_token_from_request(request, bearer_credentials)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing Bearer token or authorization cookie.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Decode and validate token payload
    payload = decode_token(token)
    user_id_raw: Optional[str] = payload.get("sub")
    token_type: Optional[str] = payload.get("type")

    if not user_id_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing subject identifier.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if token_type and token_type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token type '{token_type}': access token expected.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_uuid = uuid.UUID(str(user_id_raw))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject: malformed user UUID.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Query user from DB with eager loaded role
    query = (
        select(User)
        .options(selectinload(User.role))
        .where(User.id == user_uuid, User.is_deleted == False)
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or has been removed.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Please contact an administrator.",
        )

    if user.is_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is locked due to security restrictions. Contact administrator.",
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Convenience alias ensuring current user is active."""
    return current_user


class RoleChecker:
    """
    Reusable callable class for FastAPI dependencies to enforce role-based access control (RBAC).
    Super administrators automatically bypass role constraints.
    """

    def __init__(self, allowed_roles: Sequence[Union[str, RoleEnum]]):
        self.allowed_roles = set()
        for r in allowed_roles:
            if isinstance(r, RoleEnum):
                self.allowed_roles.add(r.value.lower())
            elif isinstance(r, str):
                self.allowed_roles.add(r.lower())

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if not current_user.role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User has no role assigned.",
            )

        user_role = current_user.role.name.lower()

        # Super admin always bypasses specific role requirements
        if user_role == RoleEnum.SUPER_ADMIN.value.lower():
            return current_user

        if user_role not in self.allowed_roles:
            roles_str = ", ".join(sorted(self.allowed_roles))
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required role: {roles_str}.",
            )

        return current_user


def require_role(*roles: Union[str, RoleEnum]) -> RoleChecker:
    """
    Dependency factory that restricts route access to users possessing any of the specified roles.

    Example:
        @router.get("/admin-only", dependencies=[Depends(require_role(RoleEnum.SUPER_ADMIN))])
    """
    return RoleChecker(roles)


def require_permission(permission: str) -> Callable[..., Any]:
    """
    Dependency factory that checks if the user's assigned role contains a specific permission.
    Super administrators automatically possess all permissions.

    Supports:
        - Exact permission match: `permissions.get("payment:approve") == True`
        - Wildcard match: `permissions.get("*") == True` or `"*" in permissions`
        - Resource-action lists: `permissions.get("payment") == ["approve", "read"]`
    """

    async def permission_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if not current_user.role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User has no role assigned.",
            )

        # Super administrator bypasses all permission checks
        if current_user.role.name.lower() == RoleEnum.SUPER_ADMIN.value.lower():
            return current_user

        permissions = current_user.role.permissions or {}

        # 1. Global wildcard
        if permissions.get("*") is True or "*" in permissions:
            return current_user

        # 2. Exact match boolean
        if permissions.get(permission) is True:
            return current_user

        # 3. Check colon format, e.g. "payment_requests:approve"
        if ":" in permission:
            resource, action = permission.split(":", 1)
            resource_perm = permissions.get(resource)
            if resource_perm is True or resource_perm == "*":
                return current_user
            if isinstance(resource_perm, list) and (action in resource_perm or "*" in resource_perm):
                return current_user
            if isinstance(resource_perm, dict) and resource_perm.get(action) is True:
                return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: '{permission}' permission is required for this action.",
        )

    return permission_checker

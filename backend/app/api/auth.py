"""
Authentication and User Session API Router.

Implements:
- POST /api/auth/login - Rate-limited user login & JWT token issuance
- POST /api/auth/logout - Invalidate active session and revoke credentials
- POST /api/auth/refresh - Refresh access token using valid refresh token
- POST /api/auth/forgot-password - Secure password reset request
- POST /api/auth/reset-password - Confirm password reset with signed token
- GET /api/auth/me - Retrieve current authenticated user profile
- PUT /api/auth/change-password - Update user password with current credential verification
"""

from datetime import datetime, timedelta, timezone
import hashlib
import logging
from typing import Any, Dict, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import extract_token_from_request, get_current_user
from app.middleware.rate_limit import LOGIN_RATE_LIMIT, PASSWORD_RESET_RATE_LIMIT, get_client_ip, limiter
from app.models.audit_log import AuditEventType, AuditLog
from app.models.role import Role
from app.models.session import UserSession
from app.models.user import User
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger("mv-payment-approval.api.auth")
settings = get_settings()

router = APIRouter(prefix="/auth", tags=["Auth"])


# --------------------------------------------------------------------------
# Pydantic Schemas for Auth Requests & Responses
# --------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="User registered email address")
    password: str = Field(..., min_length=1, description="Account password")


class RoleInfo(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str
    permissions: Dict[str, Any]

    model_config = {"from_attributes": True}


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    full_name: str
    role_id: uuid.UUID
    role: Optional[RoleInfo] = None
    department_id: Optional[uuid.UUID] = None
    company_id: Optional[uuid.UUID] = None
    is_active: bool
    email_verified: bool
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserProfileResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: Optional[str] = Field(None, description="Optional if provided via secure cookie")


class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="Account email to dispatch reset instructions")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Signed password reset token")
    new_password: str = Field(..., min_length=8, description="New strong password (min 8 characters)")


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password (min 8 characters)")


class MessageResponse(BaseModel):
    success: bool = True
    message: str


# --------------------------------------------------------------------------
# Helper Audit Logging Function
# --------------------------------------------------------------------------

async def record_audit_event(
    db: AsyncSession,
    event_type: AuditEventType,
    entity_type: str,
    request: Request,
    user_id: Optional[uuid.UUID] = None,
    entity_id: Optional[uuid.UUID] = None,
    previous_value: Optional[Dict[str, Any]] = None,
    new_value: Optional[Dict[str, Any]] = None,
) -> None:
    """Helper to record audit logs inside the current database session."""
    try:
        ip = get_client_ip(request)
        ua = request.headers.get("User-Agent")
        if ua and len(ua) > 500:
            ua = ua[:500]

        log_entry = AuditLog(
            user_id=user_id,
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            previous_value=previous_value,
            new_value=new_value,
            ip_address=ip,
            user_agent=ua,
        )
        db.add(log_entry)
        await db.flush()
    except Exception as exc:
        logger.error("Failed to write audit log: %s", exc, exc_info=True)


def hash_token_identifier(token: str) -> str:
    """Computes SHA-256 hash of token for safe DB storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="User Login",
    description="Authenticates credentials, updates login metadata, and returns JWT tokens.",
)
@limiter.limit(LOGIN_RATE_LIMIT)
async def login(
    request: Request,
    credentials: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    email_clean = credentials.email.lower().strip()
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent")

    # Fetch user with role
    query = (
        select(User)
        .options(selectinload(User.role))
        .where(User.email == email_clean, User.is_deleted == False)
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        await record_audit_event(
            db,
            AuditEventType.USER_LOGIN_FAILED,
            "user",
            request,
            new_value={"email": email_clean, "reason": "user_not_found"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.is_locked:
        await record_audit_event(
            db,
            AuditEventType.USER_LOGIN_FAILED,
            "user",
            request,
            user_id=user.id,
            entity_id=user.id,
            new_value={"reason": "account_locked"},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is locked due to multiple failed login attempts. Contact an administrator.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact an administrator.",
        )

    # Verify password hash
    if not verify_password(credentials.password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.is_locked = True
            await record_audit_event(
                db,
                AuditEventType.USER_LOCKED,
                "user",
                request,
                user_id=user.id,
                entity_id=user.id,
                new_value={"failed_attempts": user.failed_login_attempts},
            )
        await record_audit_event(
            db,
            AuditEventType.USER_LOGIN_FAILED,
            "user",
            request,
            user_id=user.id,
            entity_id=user.id,
            new_value={"failed_attempts": user.failed_login_attempts},
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Reset failed attempts and update last login
    user.failed_login_attempts = 0
    user.last_login = datetime.now(timezone.utc)

    # Generate Access & Refresh Tokens
    role_name = user.role.name if user.role else "user"
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": role_name}
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.id)}
    )

    # Store UserSession in database
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    token_hash = hash_token_identifier(refresh_token)

    session_record = UserSession(
        user_id=user.id,
        token_hash=token_hash,
        ip_address=client_ip,
        user_agent=user_agent[:500] if user_agent else None,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(session_record)

    await record_audit_event(
        db,
        AuditEventType.USER_LOGIN,
        "user",
        request,
        user_id=user.id,
        entity_id=user.id,
    )
    await db.commit()

    # Optional: Set secure HTTP-only cookies
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserProfileResponse.model_validate(user),
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="User Logout",
    description="Terminates active session and clears authentication cookies.",
)
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Invalidate session if refresh token provided in cookie or body
    cookie_refresh = request.cookies.get("refresh_token")
    if cookie_refresh:
        th = hash_token_identifier(cookie_refresh)
        stmt = (
            update(UserSession)
            .where(UserSession.token_hash == th)
            .values(is_active=False)
        )
        await db.execute(stmt)

    await record_audit_event(
        db,
        AuditEventType.USER_LOGOUT,
        "user",
        request,
        user_id=current_user.id,
        entity_id=current_user.id,
    )
    await db.commit()

    # Clear authentication cookies
    response.delete_cookie(key="access_token")
    response.delete_cookie(key="refresh_token")

    return MessageResponse(success=True, message="Successfully logged out.")


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh Access Token",
    description="Exchanges a valid refresh token for a fresh access token.",
)
async def refresh_token(
    request: Request,
    payload_in: RefreshTokenRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    token = payload_in.refresh_token or request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is missing from request body and cookie.",
        )

    # Decode and validate
    decoded = decode_token(token)
    token_type = decoded.get("type")
    user_id_str = decoded.get("sub")

    if token_type != "refresh" or not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token.",
        )

    user_id = uuid.UUID(str(user_id_str))
    th = hash_token_identifier(token)

    # Verify session active in database
    session_query = select(UserSession).where(
        UserSession.token_hash == th,
        UserSession.user_id == user_id,
        UserSession.is_active == True,
    )
    session_result = await db.execute(session_query)
    user_session = session_result.scalar_one_or_none()

    if not user_session or user_session.is_expired:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or been revoked. Please sign in again.",
        )

    # Fetch user
    user_query = (
        select(User)
        .options(selectinload(User.role))
        .where(User.id == user_id, User.is_deleted == False)
    )
    user_res = await db.execute(user_query)
    user = user_res.scalar_one_or_none()

    if not user or not user.is_active or user.is_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated or locked.",
        )

    # Issue new access token
    role_name = user.role.name if user.role else "user"
    new_access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": role_name}
    )

    response.set_cookie(
        key="access_token",
        value=f"Bearer {new_access_token}",
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserProfileResponse.model_validate(user),
    )


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Request Password Reset",
    description="Initiates password recovery for the provided email address.",
)
@limiter.limit(PASSWORD_RESET_RATE_LIMIT)
async def forgot_password(
    request: Request,
    payload_in: ForgotPasswordRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    email_clean = payload_in.email.lower().strip()
    query = select(User).where(User.email == email_clean, User.is_deleted == False)
    res = await db.execute(query)
    user = res.scalar_one_or_none()

    if user and user.is_active:
        # Generate short-lived reset token (15 minutes)
        reset_token = create_access_token(
            data={"sub": str(user.id), "type": "password_reset"},
            expires_delta=timedelta(minutes=15),
        )
        logger.info("Password reset token generated for user: %s", user.email)
        # In production this dispatches an email via SMTP or background worker

    return MessageResponse(
        success=True,
        message="If an account exists with that email address, password reset instructions have been sent.",
    )


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Confirm Password Reset",
    description="Resets account password using a valid reset token.",
)
@limiter.limit(PASSWORD_RESET_RATE_LIMIT)
async def reset_password(
    request: Request,
    payload_in: ResetPasswordRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    decoded = decode_token(payload_in.token)
    if decoded.get("type") != "password_reset" or not decoded.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token.",
        )

    user_id = uuid.UUID(str(decoded["sub"]))
    query = select(User).where(User.id == user_id, User.is_deleted == False)
    res = await db.execute(query)
    user = res.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account associated with this token is invalid or inactive.",
        )

    # Update password and unlock
    user.password_hash = hash_password(payload_in.new_password)
    user.is_locked = False
    user.failed_login_attempts = 0

    # Revoke all active sessions
    revoke_stmt = (
        update(UserSession)
        .where(UserSession.user_id == user.id)
        .values(is_active=False)
    )
    await db.execute(revoke_stmt)

    await record_audit_event(
        db,
        AuditEventType.PASSWORD_CHANGED,
        "user",
        request,
        user_id=user.id,
        entity_id=user.id,
        new_value={"action": "password_reset_confirmed"},
    )
    await db.commit()

    return MessageResponse(success=True, message="Password has been reset successfully. Please log in.")


@router.get(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current User Profile",
    description="Returns detailed profile of the currently authenticated user.",
)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    return UserProfileResponse.model_validate(current_user)


@router.put(
    "/change-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Change Password",
    description="Updates user password after verifying current credentials.",
)
async def change_password(
    request: Request,
    payload_in: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload_in.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if payload_in.current_password == payload_in.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be the same as the current password.",
        )

    current_user.password_hash = hash_password(payload_in.new_password)

    await record_audit_event(
        db,
        AuditEventType.PASSWORD_CHANGED,
        "user",
        request,
        user_id=current_user.id,
        entity_id=current_user.id,
        new_value={"action": "user_self_change_password"},
    )
    await db.commit()

    return MessageResponse(success=True, message="Password updated successfully.")

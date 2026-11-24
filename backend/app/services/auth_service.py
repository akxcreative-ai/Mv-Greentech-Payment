"""
Authentication Service for MV Payment Approval System.

Handles user credential verification with Argon2id, JWT token issuance with python-jose,
account lockout policies, session management, password resets, and email verification.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import logging
from typing import Any, Dict, Optional, Tuple, Union
import uuid

from fastapi import HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models.audit_log import AuditEventType
from app.models.session import UserSession
from app.models.user import User
from app.services.audit_service import log_event
from app.utils.email import send_email
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)
settings = get_settings()

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 30


async def check_account_lockout(
    user: User,
    db: AsyncSession,
) -> bool:
    """
    Checks if a user's account is locked.
    Locks after 5 failed attempts; automatically unlocks after 30 minutes.

    Args:
        user: The User ORM model instance.
        db: Active AsyncSession database session.

    Returns:
        True if the account is currently locked, False if active/unlocked.
    """
    if not user.is_locked:
        # Check if failed attempts reached threshold without lock flag set
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.is_locked = True
            await log_event(
                user_id=user.id,
                event_type=AuditEventType.USER_LOCKED,
                entity_type="user",
                entity_id=user.id,
                previous_value={"is_locked": False, "failed_attempts": user.failed_login_attempts},
                new_value={"is_locked": True, "failed_attempts": user.failed_login_attempts},
                ip=None,
                user_agent=None,
                db=db,
            )
            await db.flush()
            return True
        return False

    # Account is marked locked; check if 30-minute lockout window has elapsed
    now = datetime.now(timezone.utc)
    reference_time = user.updated_at or user.created_at
    if reference_time:
        if reference_time.tzinfo is None:
            reference_time = reference_time.replace(tzinfo=timezone.utc)

        elapsed = now - reference_time
        if elapsed >= timedelta(minutes=LOCKOUT_DURATION_MINUTES):
            # Auto-unlock
            user.is_locked = False
            user.failed_login_attempts = 0
            await log_event(
                user_id=user.id,
                event_type=AuditEventType.USER_UNLOCKED,
                entity_type="user",
                entity_id=user.id,
                previous_value={"is_locked": True},
                new_value={"is_locked": False, "reason": "auto_unlock_timeout"},
                ip=None,
                user_agent=None,
                db=db,
            )
            await db.flush()
            return False

    return True


async def register_login_attempt(
    user_id: Optional[Union[uuid.UUID, str]],
    success: bool,
    ip: Optional[str],
    user_agent: Optional[str],
    db: AsyncSession,
    refresh_token: Optional[str] = None,
) -> None:
    """
    Registers a login attempt in audit logs and creates a session upon success.

    Args:
        user_id: User UUID (or None for unrecognized accounts).
        success: True if authentication succeeded, False otherwise.
        ip: Client IP address.
        user_agent: Client user-agent string.
        db: Active AsyncSession.
        refresh_token: Refresh token string if session should be registered.
    """
    parsed_user_id: Optional[uuid.UUID] = None
    if user_id:
        parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

    if success and parsed_user_id:
        # Create active UserSession record
        token_hash = (
            hashlib.sha256(refresh_token.encode()).hexdigest()
            if refresh_token
            else hashlib.sha256(
                f"{parsed_user_id}:{datetime.now(timezone.utc).isoformat()}:{ip}".encode()
            ).hexdigest()
        )

        session_entry = UserSession(
            user_id=parsed_user_id,
            token_hash=token_hash,
            ip_address=str(ip)[:45] if ip else None,
            user_agent=str(user_agent)[:500] if user_agent else None,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            is_active=True,
        )
        db.add(session_entry)

        # Audit log event
        await log_event(
            user_id=parsed_user_id,
            event_type=AuditEventType.USER_LOGIN,
            entity_type="user",
            entity_id=parsed_user_id,
            previous_value=None,
            new_value={"status": "success", "ip": ip},
            ip=ip,
            user_agent=user_agent,
            db=db,
        )
    else:
        # Audit log failed event
        await log_event(
            user_id=parsed_user_id,
            event_type=AuditEventType.USER_LOGIN_FAILED,
            entity_type="user",
            entity_id=parsed_user_id,
            previous_value=None,
            new_value={"status": "failed", "ip": ip},
            ip=ip,
            user_agent=user_agent,
            db=db,
        )

    await db.flush()


async def authenticate_user(
    email: str,
    password: str,
    db: AsyncSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Optional[User]:
    """
    Authenticates a user by email and password using Argon2id.
    Enforces account lockout after 5 consecutive failed attempts.

    Args:
        email: User email address.
        password: Plain-text password to verify.
        db: Active AsyncSession database session.
        ip: Optional client IP address.
        user_agent: Optional client user agent string.

    Returns:
        User model instance if authenticated successfully; None otherwise.

    Raises:
        HTTPException: 403 Forbidden if account is locked or deactivated.
    """
    clean_email = email.strip().lower()

    stmt = (
        select(User)
        .options(
            selectinload(User.role),
            selectinload(User.company),
            selectinload(User.department),
        )
        .where(
            func.lower(User.email) == clean_email,
            User.is_deleted.is_(False),
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        await register_login_attempt(None, False, ip, user_agent, db)
        return None

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact your system administrator.",
        )

    # Check for account lockout (locks after 5 failed attempts, unlocks after 30 mins)
    is_locked = await check_account_lockout(user, db)
    if is_locked:
        await register_login_attempt(user.id, False, ip, user_agent, db)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Account is temporarily locked due to multiple consecutive failed login attempts. "
                "It will automatically unlock after 30 minutes, or you can request a password reset."
            ),
        )

    # Verify Argon2id password hash
    is_valid = verify_password(password, user.password_hash)

    if not is_valid:
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.is_locked = True
            await log_event(
                user_id=user.id,
                event_type=AuditEventType.USER_LOCKED,
                entity_type="user",
                entity_id=user.id,
                previous_value={"failed_attempts": user.failed_login_attempts - 1, "is_locked": False},
                new_value={"failed_attempts": user.failed_login_attempts, "is_locked": True},
                ip=ip,
                user_agent=user_agent,
                db=db,
            )
        await register_login_attempt(user.id, False, ip, user_agent, db)
        await db.flush()
        return None

    # Password is valid: reset failed attempts counter & update last login
    user.failed_login_attempts = 0
    user.last_login = datetime.now(timezone.utc)
    await register_login_attempt(user.id, True, ip, user_agent, db)
    await db.flush()
    return user


def create_tokens(user: User) -> Tuple[str, str]:
    """
    Creates signed JWT access token and refresh token for the authenticated user.

    Args:
        user: The User ORM model instance.

    Returns:
        Tuple of (access_token: str, refresh_token: str).
    """
    role_name = user.role.name if user.role else None

    # Build access token payload
    access_payload = {
        "sub": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": role_name,
        "company_id": str(user.company_id) if user.company_id else None,
        "department_id": str(user.department_id) if user.department_id else None,
    }
    access_token = create_access_token(
        data=access_payload,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    # Build refresh token payload
    refresh_payload = {
        "sub": str(user.id),
        "type": "refresh",
    }
    refresh_token = create_refresh_token(
        data=refresh_payload,
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )

    return access_token, refresh_token


async def refresh_access_token(
    refresh_token: str,
    db: AsyncSession,
) -> Tuple[str, str]:
    """
    Validates a refresh token and issues a new access token and refresh token pair.

    Args:
        refresh_token: Encoded JWT refresh token string.
        db: Active AsyncSession database session.

    Returns:
        Tuple of (new_access_token: str, new_refresh_token: str).

    Raises:
        HTTPException: 401 Unauthorized if token is invalid, expired, or user is inactive.
    """
    payload = decode_token(refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type for refresh operation.",
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing subject identifier.",
        )

    try:
        user_uuid = uuid.UUID(str(user_id_str))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identifier format.",
        )

    stmt = (
        select(User)
        .options(
            selectinload(User.role),
            selectinload(User.company),
            selectinload(User.department),
        )
        .where(
            User.id == user_uuid,
            User.is_deleted.is_(False),
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not user.is_active or user.is_locked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is deactivated, locked, or no longer exists.",
        )

    # Invalidate old refresh session if tracked by token hash
    old_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    stmt_session = (
        update(UserSession)
        .where(
            UserSession.user_id == user.id,
            UserSession.token_hash == old_hash,
        )
        .values(is_active=False)
    )
    await db.execute(stmt_session)

    new_access_token, new_refresh_token = create_tokens(user)

    # Save new active session
    new_hash = hashlib.sha256(new_refresh_token.encode()).hexdigest()
    new_session = UserSession(
        user_id=user.id,
        token_hash=new_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        is_active=True,
    )
    db.add(new_session)
    await db.flush()

    return new_access_token, new_refresh_token


async def logout(
    user_id: Union[uuid.UUID, str],
    token: Optional[str],
    db: AsyncSession,
) -> bool:
    """
    Invalidates user session(s) on logout.

    Args:
        user_id: User UUID logging out.
        token: Current JWT token string or refresh token hash.
        db: Active AsyncSession database session.

    Returns:
        True on successful session invalidation.
    """
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

    if token:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        stmt = (
            update(UserSession)
            .where(
                UserSession.user_id == parsed_user_id,
                UserSession.token_hash == token_hash,
            )
            .values(is_active=False)
        )
        await db.execute(stmt)
    else:
        # Revoke all active sessions for this user
        stmt = (
            update(UserSession)
            .where(
                UserSession.user_id == parsed_user_id,
                UserSession.is_active.is_(True),
            )
            .values(is_active=False)
        )
        await db.execute(stmt)

    await log_event(
        user_id=parsed_user_id,
        event_type=AuditEventType.USER_LOGOUT,
        entity_type="user",
        entity_id=parsed_user_id,
        previous_value=None,
        new_value={"action": "logout"},
        ip=None,
        user_agent=None,
        db=db,
    )
    await db.flush()
    return True


async def request_password_reset(
    email: str,
    db: AsyncSession,
) -> bool:
    """
    Initiates a password reset by generating a time-limited token and sending an email.
    Always returns True to prevent user enumeration attacks.

    Args:
        email: User email address requesting reset.
        db: Active AsyncSession database session.

    Returns:
        True always.
    """
    clean_email = email.strip().lower()

    stmt = select(User).where(
        func.lower(User.email) == clean_email,
        User.is_deleted.is_(False),
        User.is_active.is_(True),
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        logger.info("Password reset requested for non-existent email: %s", clean_email)
        return True

    # Generate password reset JWT with 30-minute validity
    reset_payload = {
        "sub": str(user.id),
        "email": user.email,
        "type": "password_reset",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
    }
    reset_token = jwt.encode(
        reset_payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    reset_url = f"{settings.APP_URL.rstrip('/')}/reset-password?token={reset_token}"
    subject = f"[{settings.APP_NAME}] Password Reset Request"
    body = (
        f"Hello {user.first_name},\n\n"
        f"A password reset request was initiated for your account on {settings.APP_NAME}.\n"
        f"Click the link below to set a new password:\n\n"
        f"{reset_url}\n\n"
        f"This link will expire in 30 minutes. If you did not request this, please ignore this email.\n"
    )

    try:
        await send_email(to=user.email, subject=subject, body=body)
    except Exception as exc:
        logger.error("Failed to send password reset email to %s: %s", user.email, exc)

    await log_event(
        user_id=user.id,
        event_type=AuditEventType.SYSTEM_EVENT,
        entity_type="user",
        entity_id=user.id,
        previous_value=None,
        new_value={"action": "password_reset_requested"},
        ip=None,
        user_agent=None,
        db=db,
    )
    return True


async def confirm_password_reset(
    token: str,
    new_password: str,
    db: AsyncSession,
) -> bool:
    """
    Validates a password reset token and applies the new Argon2id hashed password.

    Args:
        token: Cryptographic reset token.
        new_password: New plain-text password.
        db: Active AsyncSession database session.

    Returns:
        True upon successful reset.

    Raises:
        HTTPException: 400 Bad Request if token is invalid or password is weak.
    """
    if not new_password or len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters in length.",
        )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except Exception as exc:
        logger.warning("Invalid or expired password reset token: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The password reset link is invalid or has expired.",
        )

    if payload.get("type") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token purpose.",
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token structure.",
        )

    user_uuid = uuid.UUID(str(user_id_str))
    stmt = select(User).where(User.id == user_uuid, User.is_deleted.is_(False))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is deactivated or no longer exists.",
        )

    # Hash with Argon2id and reset security lockout state
    user.password_hash = hash_password(new_password)
    user.failed_login_attempts = 0
    user.is_locked = False

    # Invalidate all existing sessions
    stmt_sessions = (
        update(UserSession)
        .where(UserSession.user_id == user.id)
        .values(is_active=False)
    )
    await db.execute(stmt_sessions)

    await log_event(
        user_id=user.id,
        event_type=AuditEventType.PASSWORD_CHANGED,
        entity_type="user",
        entity_id=user.id,
        previous_value={"is_locked": True},
        new_value={"action": "password_reset_confirmed", "is_locked": False},
        ip=None,
        user_agent=None,
        db=db,
    )
    await db.flush()
    return True


async def verify_email(
    token: str,
    db: AsyncSession,
) -> User:
    """
    Verifies user email address using signed verification token.

    Args:
        token: Verification token string.
        db: Active AsyncSession database session.

    Returns:
        The updated User model instance.

    Raises:
        HTTPException: 400 Bad Request if token is invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except Exception as exc:
        logger.warning("Invalid or expired email verification token: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email verification link is invalid or has expired.",
        )

    if payload.get("type") != "email_verification":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token purpose for email verification.",
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token missing subject identifier.",
        )

    user_uuid = uuid.UUID(str(user_id_str))
    stmt = select(User).where(User.id == user_uuid, User.is_deleted.is_(False))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    user.email_verified = True
    await log_event(
        user_id=user.id,
        event_type=AuditEventType.USER_UPDATED,
        entity_type="user",
        entity_id=user.id,
        previous_value={"email_verified": False},
        new_value={"email_verified": True},
        ip=None,
        user_agent=None,
        db=db,
    )
    await db.flush()
    return user

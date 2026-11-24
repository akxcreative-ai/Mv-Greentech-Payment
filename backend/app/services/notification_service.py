"""
Notification Service for MV Payment Approval System.

Handles in-app notification lifecycle (creation, pagination, read receipts)
and asynchronous email dispatching to stakeholders.
"""

from datetime import datetime, timezone
from enum import Enum
import logging
import math
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union
import uuid

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.utils.email import send_email

logger = logging.getLogger(__name__)

T = TypeVar("T")

try:
    from app.schemas.common import PaginatedResponse
except ImportError:
    try:
        from app.schemas import PaginatedResponse
    except ImportError:

        class PaginatedResponse(BaseModel, Generic[T]):  # type: ignore
            items: List[T]
            total: int
            page: int
            page_size: int
            total_pages: int
            has_next: bool
            has_prev: bool

            class Config:
                arbitrary_types_allowed = True


async def create_notification(
    user_id: Union[uuid.UUID, str],
    title: str,
    message: str,
    type: Union[NotificationType, str] = NotificationType.INFO,
    entity_type: Optional[str] = None,
    entity_id: Optional[Union[uuid.UUID, str]] = None,
    db: Optional[AsyncSession] = None,
) -> Notification:
    """
    Creates an in-app notification record for a designated recipient.

    Args:
        user_id: Target recipient User UUID or string.
        title: Notification header title.
        message: Notification explanatory body.
        type: Classification enum or string (defaults to INFO).
        entity_type: Associated domain model name (e.g. payment_request).
        entity_id: Primary key UUID of the associated object.
        db: Active AsyncSession database session.

    Returns:
        The newly created Notification model instance.
    """
    if db is None:
        raise ValueError("Database session (db) is required.")

    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
    parsed_entity_id: Optional[uuid.UUID] = None
    if entity_id:
        parsed_entity_id = (
            entity_id if isinstance(entity_id, uuid.UUID) else uuid.UUID(str(entity_id))
        )

    parsed_type: NotificationType
    if isinstance(type, NotificationType):
        parsed_type = type
    else:
        try:
            parsed_type = NotificationType(str(type).upper())
        except ValueError:
            parsed_type = NotificationType.INFO

    notification = Notification(
        user_id=parsed_user_id,
        title=str(title).strip(),
        message=str(message).strip(),
        type=parsed_type,
        entity_type=str(entity_type).strip() if entity_type else None,
        entity_id=parsed_entity_id,
        is_read=False,
    )

    db.add(notification)
    await db.flush()
    return notification


async def get_notifications(
    user_id: Union[uuid.UUID, str],
    pagination: Optional[Union[Dict[str, Any], Any]] = None,
    db: Optional[AsyncSession] = None,
) -> Union[List[Notification], PaginatedResponse[Notification]]:
    """
    Retrieves in-app notifications for the specified user ordered by recency.

    Args:
        user_id: Recipient User UUID or string.
        pagination: Optional pagination parameters (page, page_size, limit).
        db: Active AsyncSession database session.

    Returns:
        PaginatedResponse or list of Notification objects.
    """
    if db is None:
        raise ValueError("Database session (db) is required.")

    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

    query = select(Notification).where(Notification.user_id == parsed_user_id)
    count_query = (
        select(func.count()).select_from(Notification).where(Notification.user_id == parsed_user_id)
    )

    # Handle optional pagination
    if pagination is not None:
        page = 1
        page_size = 20
        if isinstance(pagination, dict):
            page = int(pagination.get("page", 1))
            page_size = int(pagination.get("page_size", pagination.get("limit", 20)))
            if pagination.get("unread_only"):
                query = query.where(Notification.is_read.is_(False))
                count_query = count_query.where(Notification.is_read.is_(False))
        else:
            page = getattr(pagination, "page", 1)
            page_size = getattr(pagination, "page_size", getattr(pagination, "limit", 20))
            if getattr(pagination, "unread_only", False):
                query = query.where(Notification.is_read.is_(False))
                count_query = count_query.where(Notification.is_read.is_(False))

        page = max(1, page)
        page_size = max(1, min(page_size, 100))

        total_result = await db.execute(count_query)
        total = total_result.scalar_one_or_none() or 0

        offset = (page - 1) * page_size
        query = query.order_by(Notification.created_at.desc()).offset(offset).limit(page_size)
        result = await db.execute(query)
        items = list(result.scalars().all())

        total_pages = max(1, math.ceil(total / page_size)) if total > 0 else 1

        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1,
        )

    # If no pagination specified, return default top 50 recents
    query = query.order_by(Notification.created_at.desc()).limit(50)
    result = await db.execute(query)
    return list(result.scalars().all())


async def mark_read(
    notification_id: Union[uuid.UUID, str],
    user_id: Union[uuid.UUID, str],
    db: AsyncSession,
) -> Notification:
    """
    Marks a specific notification as read by its recipient.

    Args:
        notification_id: Notification primary key UUID.
        user_id: User UUID asserting ownership.
        db: Active AsyncSession database session.

    Returns:
        The updated Notification model instance.

    Raises:
        HTTPException: 404 Not Found if notification doesn't exist or doesn't belong to user.
    """
    parsed_notif_id = (
        notification_id if isinstance(notification_id, uuid.UUID) else uuid.UUID(str(notification_id))
    )
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

    stmt = select(Notification).where(
        Notification.id == parsed_notif_id,
        Notification.user_id == parsed_user_id,
    )
    result = await db.execute(stmt)
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or access denied.",
        )

    notification.mark_as_read()
    await db.flush()
    return notification


async def mark_all_read(
    user_id: Union[uuid.UUID, str],
    db: AsyncSession,
) -> int:
    """
    Marks all unread notifications for a user as read.

    Args:
        user_id: Recipient User UUID.
        db: Active AsyncSession database session.

    Returns:
        Count of notifications updated.
    """
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
    now = datetime.now(timezone.utc)

    stmt = (
        update(Notification)
        .where(
            Notification.user_id == parsed_user_id,
            Notification.is_read.is_(False),
        )
        .values(
            is_read=True,
            read_at=now,
        )
    )
    result = await db.execute(stmt)
    await db.flush()
    return result.rowcount


async def get_unread_count(
    user_id: Union[uuid.UUID, str],
    db: AsyncSession,
) -> int:
    """
    Returns the count of unread notifications for a user.

    Args:
        user_id: Recipient User UUID.
        db: Active AsyncSession database session.

    Returns:
        Integer count of unread notifications.
    """
    parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

    stmt = (
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.user_id == parsed_user_id,
            Notification.is_read.is_(False),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none() or 0


async def send_email_notification(
    user_id: Union[uuid.UUID, str],
    subject: str,
    body: str,
    db: AsyncSession,
) -> bool:
    """
    Asynchronously sends an email notification to the specified user.
    Fails safely without breaking calling database transactions.

    Args:
        user_id: Recipient User UUID.
        subject: Email subject line.
        body: Email body (plain text or HTML).
        db: Active AsyncSession database session.

    Returns:
        True if email was successfully sent, False otherwise.
    """
    try:
        parsed_user_id = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))

        stmt = select(User).where(User.id == parsed_user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.email:
            logger.warning("Cannot send email: user %s not found or has no email address.", user_id)
            return False

        if not user.is_active or user.is_deleted:
            logger.info("Skipping email notification to inactive/deleted user %s.", user.email)
            return False

        # Attempt asynchronous SMTP send
        html_content = body if "<html" in body.lower() or "<div" in body.lower() else None
        sent = await send_email(
            to=user.email,
            subject=subject,
            body=body,
            html=html_content,
        )
        return sent

    except Exception as exc:
        logger.error(
            "Failed to send email notification to user %s: %s",
            user_id,
            exc,
            exc_info=True,
        )
        return False

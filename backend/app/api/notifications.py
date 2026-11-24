"""
Notifications API Router.

Provides real-time user notification retrieval, read tracking, and badge counts:
- GET /api/notifications - List user alerts with pagination and unread filters
- GET /api/notifications/unread-count - Fetch total unread notifications badge count
- PUT /api/notifications/{id}/read - Mark single notification as read
- PUT /api/notifications/read-all - Mark all user notifications as read
"""

from datetime import datetime
import logging
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.notification import Notification, NotificationType
from app.models.user import User

logger = logging.getLogger("mv-payment-approval.api.notifications")

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class NotificationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    message: str
    type: NotificationType
    entity_type: Optional[str] = None
    entity_id: Optional[uuid.UUID] = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    total: int
    unread_count: int
    page: int
    page_size: int
    pages: int


class UnreadCountResponse(BaseModel):
    unread_count: int


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

@router.get(
    "",
    response_model=NotificationListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get User Notifications",
    description="Returns a paginated list of alerts and notifications for the current authenticated user.",
)
async def get_notifications(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    unread_only: bool = Query(False, description="Filter to show unread notifications only"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base_query = select(Notification).where(Notification.user_id == current_user.id)

    if unread_only:
        base_query = base_query.where(Notification.is_read == False)

    # Total notifications
    count_q = select(func.count()).select_from(base_query.subquery())
    total_res = await db.execute(count_q)
    total = total_res.scalar_one()

    # Total unread count
    unread_q = select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    )
    unread_res = await db.execute(unread_q)
    unread_count = unread_res.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = base_query.order_by(Notification.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    notifs = result.scalars().all()

    pages = (total + page_size - 1) // page_size if total > 0 else 1

    return NotificationListResponse(
        items=[NotificationResponse.model_validate(n) for n in notifs],
        total=total,
        unread_count=unread_count,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Unread Notification Count",
    description="Returns count of unread notifications for badge rendering.",
)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    )
    res = await db.execute(q)
    count = res.scalar_one()
    return UnreadCountResponse(unread_count=count)


@router.put(
    "/{id}/read",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark Notification As Read",
    description="Updates the read receipt status for a specific notification.",
)
async def mark_as_read(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Notification).where(
        Notification.id == id,
        Notification.user_id == current_user.id,
    )
    result = await db.execute(query)
    notif = result.scalar_one_or_none()

    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification '{id}' was not found.",
        )

    notif.is_read = True
    await db.commit()
    await db.refresh(notif)

    return NotificationResponse.model_validate(notif)


@router.put(
    "/read-all",
    status_code=status.HTTP_200_OK,
    summary="Mark All Notifications As Read",
    description="Marks all unread notifications for current user as read.",
)
async def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
        .values(is_read=True)
    )
    await db.execute(stmt)
    await db.commit()

    return {"success": True, "message": "All notifications marked as read."}

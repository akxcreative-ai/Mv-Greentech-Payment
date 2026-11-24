"""
Notification Pydantic schemas for MV Payment Approval System.
Handles in-app notification alerts, read-receipt updates, and paginated badge counts.
"""

from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.models.notification import NotificationType
from app.schemas.common import PaginatedResponse


class NotificationCreate(BaseModel):
    """
    Internal schema for dispatching a new notification to a user.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    user_id: uuid.UUID = Field(..., description="Recipient user UUID")
    title: str = Field(..., min_length=1, max_length=200, description="Notification title")
    message: str = Field(..., min_length=1, description="Notification body content")
    type: NotificationType = Field(default=NotificationType.INFO, description="Notification classification")
    entity_type: Optional[str] = Field(default=None, max_length=50, description="Associated entity model type")
    entity_id: Optional[uuid.UUID] = Field(default=None, description="Primary key UUID of the referenced entity")


class NotificationResponse(BaseModel):
    """
    User notification payload returned to frontend clients.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Notification unique identifier")
    title: str = Field(..., description="Notification headline")
    message: str = Field(..., description="Notification message body")
    type: NotificationType = Field(..., description="Notification event type")
    entity_type: Optional[str] = Field(default=None, description="Related entity type (e.g. payment_request)")
    entity_id: Optional[uuid.UUID] = Field(default=None, description="Related entity UUID")
    is_read: bool = Field(..., description="Read status flag")
    read_at: Optional[datetime] = Field(default=None, description="Timestamp when read by user")
    created_at: datetime = Field(..., description="Notification generation timestamp")


class NotificationMarkReadRequest(BaseModel):
    """
    Schema for marking one, many, or all notifications as read.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    notification_ids: Optional[List[uuid.UUID]] = Field(
        default=None,
        description="List of specific notification UUIDs to mark as read",
    )
    mark_all: bool = Field(
        default=False,
        description="If True, marks all unread notifications for current user as read",
    )


class NotificationListResponse(PaginatedResponse[NotificationResponse]):
    """
    Paginated notification collection containing aggregate unread badge count.
    """
    unread_count: int = Field(
        default=0,
        ge=0,
        description="Total number of unread notifications for the authenticated user",
    )

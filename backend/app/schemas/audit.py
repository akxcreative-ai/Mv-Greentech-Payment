"""
Audit Log Pydantic schemas for MV Payment Approval System.
Maintains tamper-evident audit trails of user operations, state changes, diffs, and network context.
"""

from datetime import datetime
from typing import Any, Dict, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.models.audit_log import AuditEventType
from app.schemas.common import PaginatedResponse
from app.schemas.user import UserSummary


class AuditLogResponse(BaseModel):
    """
    Immutable compliance audit record returned for inspection and reporting.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Audit log unique identifier")
    user_id: Optional[uuid.UUID] = Field(default=None, description="Actor user UUID")
    user: Optional[UserSummary] = Field(default=None, description="Actor user profile details")
    event_type: AuditEventType = Field(..., description="Categorized audit event classification")
    entity_type: str = Field(..., description="Target model name (e.g. payment_request, vendor)")
    entity_id: Optional[uuid.UUID] = Field(default=None, description="Target entity UUID")
    previous_value: Optional[Dict[str, Any]] = Field(default=None, description="Pre-mutation snapshot of attributes")
    new_value: Optional[Dict[str, Any]] = Field(default=None, description="Post-mutation snapshot of attributes")
    ip_address: Optional[str] = Field(default=None, description="Client IP address where action originated")
    user_agent: Optional[str] = Field(default=None, description="Client device / user agent string")
    created_at: datetime = Field(..., description="Timestamp when event was logged")


class AuditLogFilter(BaseModel):
    """
    Filter parameters for searching and exporting audit trail records.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    event_type: Optional[AuditEventType] = Field(default=None, description="Filter by event type")
    user_id: Optional[uuid.UUID] = Field(default=None, description="Filter by user who performed the action")
    entity_type: Optional[str] = Field(default=None, description="Filter by entity type (e.g. payment_request)")
    date_from: Optional[datetime] = Field(default=None, description="Filter records on or after this timestamp")
    date_to: Optional[datetime] = Field(default=None, description="Filter records on or before this timestamp")
    search: Optional[str] = Field(default=None, description="Optional search term matching entity or IP")


class AuditLogListResponse(PaginatedResponse[AuditLogResponse]):
    """Paginated collection of audit log entries."""
    pass

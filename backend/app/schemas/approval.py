"""
Approval and Clarification Pydantic schemas for MV Payment Approval System.
Handles multi-tier approval actions, amount modifications, and clarification threads.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.models.approval import ApprovalStatus
from app.schemas.common import PaginatedResponse
from app.schemas.user import UserSummary


class ApprovalAction(BaseModel):
    """
    Action payload submitted by designated approvers.
    Enforces justification when rejecting or demanding clarifications.
    Accepts status, comment (or reason), and approved_amount.
    """
    model_config = ConfigDict(str_strip_whitespace=True, populate_by_name=True)

    status: ApprovalStatus = Field(
        ...,
        description="Approval decision: APPROVED, REJECTED, or CLARIFICATION_REQUIRED",
    )
    comment: Optional[str] = Field(
        default=None,
        max_length=2000,
        alias="reason",
        description="Approver notes, justifications, or queries (mandatory for rejections/clarifications)",
    )
    approved_amount: Optional[Decimal] = Field(
        default=None,
        gt=Decimal("0.00"),
        decimal_places=2,
        description="Adjusted approved amount if different from original request total",
    )

    @property
    def reason(self) -> Optional[str]:
        return self.comment

    @model_validator(mode="after")
    def validate_action_comment(self) -> "ApprovalAction":
        """Require comment justification when rejecting or seeking clarification."""
        if self.status in (ApprovalStatus.REJECTED, ApprovalStatus.CLARIFICATION_REQUIRED):
            if not self.comment or not self.comment.strip():
                raise ValueError(
                    f"A clear explanation/comment is required when setting status to '{self.status.value}'."
                )
        return self


class ApprovalRecordResponse(BaseModel):
    """
    Immutable audit record documenting an approval step, timestamp, and amount adjustment.
    """
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID = Field(..., description="Approval record unique identifier")
    payment_request_id: uuid.UUID = Field(..., description="Target payment request UUID")
    approver_id: Optional[uuid.UUID] = Field(default=None, description="Approver user UUID")
    approver: Optional[UserSummary] = Field(default=None, description="Approver user profile details")
    status: ApprovalStatus = Field(..., description="Decision outcome")
    comment: Optional[str] = Field(default=None, description="Approver comment or notes")
    original_amount: Decimal = Field(..., description="Requested payment total amount at review time")
    approved_amount: Optional[Decimal] = Field(default=None, description="Final approved amount")
    ip_address: Optional[str] = Field(default=None, description="IP address where decision was taken")
    created_at: datetime = Field(..., description="Timestamp when decision was recorded")

    @computed_field
    @property
    def reason(self) -> Optional[str]:
        """Alias returning comment for client compatibility."""
        return self.comment


class ApprovalRecordListResponse(PaginatedResponse[ApprovalRecordResponse]):
    """Paginated collection of approval decision records."""
    pass


class ClarificationCreate(BaseModel):
    """
    Payload for asking or answering a clarification inquiry on a payment request.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Clarification inquiry or reply message text",
    )
    is_response: bool = Field(
        default=False,
        description="False for queries from approver; True for responses from requester",
    )


class ClarificationResponse(BaseModel):
    """
    Clarification dialog entry with sender details and timestamp.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Clarification message unique identifier")
    payment_request_id: Optional[uuid.UUID] = Field(default=None, description="Associated payment request UUID")
    sender_id: Optional[uuid.UUID] = Field(default=None, description="Sender user UUID")
    sender: Optional[UserSummary] = Field(default=None, description="Sender profile details")
    message: str = Field(..., description="Inquiry or response text content")
    is_response: bool = Field(..., description="Whether this message is a response to an earlier query")
    created_at: datetime = Field(..., description="Message creation timestamp")


class ClarificationListResponse(PaginatedResponse[ClarificationResponse]):
    """Paginated collection of clarification messages."""
    pass

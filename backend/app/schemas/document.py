"""
Document Pydantic schemas for MV Payment Approval System.
Handles document attachments, file metadata, invoice scans, and payment proof receipts.
"""

from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PaginatedResponse


class DocumentUploaderSummary(BaseModel):
    """Compact summary of user who uploaded the document."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="User unique identifier")
    email: str = Field(..., description="User email address")
    first_name: str = Field(..., description="First name")
    last_name: str = Field(..., description="Last name")
    full_name: str = Field(..., description="Full name")


class PaymentRequestDocumentBase(BaseModel):
    """Base document metadata attributes."""
    model_config = ConfigDict(str_strip_whitespace=True)

    original_name: str = Field(
        ...,
        description="Original name of the uploaded file",
    )
    file_size: int = Field(
        ...,
        ge=0,
        description="Size of the document in bytes",
    )
    mime_type: str = Field(
        ...,
        description="MIME type (e.g. application/pdf, image/jpeg, image/png)",
    )


class PaymentRequestDocumentCreate(PaymentRequestDocumentBase):
    """
    Schema for persisting document metadata upon successful file upload.
    """
    payment_request_id: uuid.UUID = Field(
        ...,
        description="Parent payment request UUID",
    )
    file_name: str = Field(
        ...,
        description="Generated secure storage filename on disk/cloud",
    )
    file_path: str = Field(
        ...,
        description="Relative or storage path to retrieve document",
    )
    uploaded_by_id: uuid.UUID = Field(
        ...,
        description="User UUID who uploaded the document",
    )


class PaymentRequestDocumentResponse(PaymentRequestDocumentBase):
    """
    Client response schema for document attachments.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(..., description="Document unique identifier")
    payment_request_id: uuid.UUID = Field(..., description="Associated payment request UUID")
    file_name: str = Field(..., description="Stored filename identifier")
    file_path: str = Field(..., description="File retrieval endpoint or access URL")
    uploaded_by_id: uuid.UUID = Field(..., description="Uploader user UUID")
    created_at: datetime = Field(..., description="Timestamp when file was uploaded")
    uploaded_by: Optional[DocumentUploaderSummary] = Field(
        default=None,
        description="User details who uploaded this file",
    )


class PaymentRequestDocumentListResponse(PaginatedResponse[PaymentRequestDocumentResponse]):
    """Paginated collection of uploaded documents."""
    pass

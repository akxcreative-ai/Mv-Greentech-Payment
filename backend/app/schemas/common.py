"""
Common reusable Pydantic schemas for MV Payment Approval System.
Provides pagination parameters, generic paginated responses, and standard status responses.
"""

from enum import Enum
import math
from typing import Any, Dict, Generic, List, Optional, Sequence, TypeVar
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class SortOrder(str, Enum):
    """Sort direction options."""
    ASC = "asc"
    DESC = "desc"


class PaginationParams(BaseModel):
    """
    Standard pagination query parameters.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    page: int = Field(
        default=1,
        ge=1,
        description="Page number (1-indexed)",
    )
    page_size: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Number of records per page (max 100)",
    )
    sort_by: Optional[str] = Field(
        default="created_at",
        description="Attribute/column name to sort by",
    )
    sort_order: SortOrder = Field(
        default=SortOrder.DESC,
        description="Sort direction: asc or desc",
    )

    @property
    def offset(self) -> int:
        """Calculate database SQL OFFSET value."""
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        """Calculate database SQL LIMIT value."""
        return self.page_size


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Generic container for paginated result sets.
    """
    model_config = ConfigDict(from_attributes=True)

    items: List[T] = Field(
        ...,
        description="Collection of records for the requested page",
    )
    total: int = Field(
        ...,
        ge=0,
        description="Total number of items matching the query across all pages",
    )
    page: int = Field(
        ...,
        ge=1,
        description="Current page number",
    )
    page_size: int = Field(
        ...,
        ge=1,
        description="Number of items per page",
    )
    total_pages: int = Field(
        ...,
        ge=0,
        description="Total number of pages available",
    )

    @classmethod
    def create(
        cls,
        items: Sequence[T],
        total: int,
        page: int,
        page_size: int,
    ) -> "PaginatedResponse[T]":
        """
        Factory helper to compute total_pages and assemble PaginatedResponse.
        """
        calculated_pages = math.ceil(total / page_size) if page_size > 0 else 0
        return cls(
            items=list(items),
            total=total,
            page=page,
            page_size=page_size,
            total_pages=calculated_pages,
        )


class MessageResponse(BaseModel):
    """
    Standard informational / operation acknowledgement response.
    """
    model_config = ConfigDict(from_attributes=True)

    message: str = Field(
        ...,
        description="Human-readable success or status message",
    )
    detail: Optional[str] = Field(
        default=None,
        description="Optional additional context or instructions",
    )


class ErrorResponse(BaseModel):
    """
    Standardized API error response schema.
    """
    model_config = ConfigDict(from_attributes=True)

    detail: str = Field(
        ...,
        description="Descriptive explanation of the error",
    )
    error_code: Optional[str] = Field(
        default=None,
        description="Machine-readable application error code (e.g. INSUFFICIENT_PERMISSIONS)",
    )
    errors: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Detailed list of validation or field-level issues",
    )

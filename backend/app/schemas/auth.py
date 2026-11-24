"""
Authentication and Authorization Pydantic schemas for MV Payment Approval System.
Handles user credentials, JWT token payloads, token refreshes, and password management flows.
"""

from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    """
    User login credentials schema.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr = Field(
        ...,
        description="Registered corporate email address",
    )
    password: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="User password",
    )

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class LoginResponse(BaseModel):
    """
    Successful authentication response containing JWT tokens and authenticated user profile.
    """
    model_config = ConfigDict(from_attributes=True)

    access_token: str = Field(
        ...,
        description="JWT access token for authenticating subsequent requests",
    )
    refresh_token: str = Field(
        ...,
        description="Opaque or JWT refresh token to obtain a new access token",
    )
    token_type: str = Field(
        default="bearer",
        description="Token authorization scheme (Bearer)",
    )
    expires_in: Optional[int] = Field(
        default=None,
        description="Access token lifespan in seconds",
    )
    user: UserResponse = Field(
        ...,
        description="Authenticated user identity and profile details",
    )


class TokenPayload(BaseModel):
    """
    Decoded JWT token claims payload structure.
    """
    model_config = ConfigDict(from_attributes=True)

    sub: str = Field(
        ...,
        description="Subject claim (User ID string representation)",
    )
    role: str = Field(
        ...,
        description="Role identifier string for RBAC authorization checks",
    )
    exp: int = Field(
        ...,
        description="Expiration timestamp in seconds since Unix epoch",
    )
    email: Optional[str] = Field(
        default=None,
        description="User email address encoded in token",
    )
    company_id: Optional[str] = Field(
        default=None,
        description="Associated company identifier",
    )
    department_id: Optional[str] = Field(
        default=None,
        description="Associated department identifier",
    )
    jti: Optional[str] = Field(
        default=None,
        description="Unique JWT token identifier for revocation tracking",
    )


class RefreshTokenRequest(BaseModel):
    """
    Schema for renewing expired JWT access tokens.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    refresh_token: str = Field(
        ...,
        min_length=1,
        description="Active refresh token string issued during authentication",
    )


class PasswordResetRequest(BaseModel):
    """
    Initiates the forgot-password recovery flow.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr = Field(
        ...,
        description="Registered email address to send password reset instructions",
    )

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class PasswordResetConfirm(BaseModel):
    """
    Finalizes password reset using a verified reset token.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    token: str = Field(
        ...,
        min_length=1,
        description="One-time password reset verification token",
    )
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="New user password (minimum 8 characters)",
    )

    @field_validator("new_password")
    @classmethod
    def validate_password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters long.")
        return v


class ChangePasswordRequest(BaseModel):
    """
    Schema for authenticated users changing their own passwords.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    current_password: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Current account password for identity verification",
    )
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="New desired password (minimum 8 characters)",
    )

    @field_validator("new_password")
    @classmethod
    def validate_password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters long.")
        return v

    @model_validator(mode="after")
    def verify_password_different(self) -> "ChangePasswordRequest":
        """Ensure user is not reusing the exact current password."""
        if self.current_password == self.new_password:
            raise ValueError("New password must be different from the current password.")
        return self

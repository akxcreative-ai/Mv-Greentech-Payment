"""
Application Configuration Module.

Loads configuration settings from environment variables and .env file
using Pydantic BaseSettings with robust validation.
"""

from functools import lru_cache
import json
import os
from pathlib import Path
from typing import Annotated, Any, List, Union

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application Settings configuration class.
    Reads configuration values from environment variables or .env file.
    """

    # Application Metadata
    APP_NAME: str = Field(default="MV Payment Approval", description="Name of the application")
    APP_URL: str = Field(default="http://localhost:3000", description="Frontend/Client base URL")
    ENVIRONMENT: str = Field(
        default="development",
        description="Deployment environment (development, staging, production)",
    )

    # Database Configuration (PostgreSQL with asyncpg)
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/mv_payment_db",
        description="Database connection URL with asyncpg driver",
    )

    # Security & JWT Configuration
    SECRET_KEY: str = Field(
        default="mv-payment-approval-super-secret-key-change-in-production-min-32-chars",
        description="Primary application secret key for encryption and signing",
    )
    JWT_SECRET_KEY: str = Field(
        default="mv-payment-approval-jwt-secret-key-change-in-production-min-32-chars",
        description="Secret key specifically used for signing and verifying JWT tokens",
    )
    JWT_ALGORITHM: str = Field(default="HS256", description="Algorithm used to sign JWTs")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=30,
        description="Access token lifespan in minutes",
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=7,
        description="Refresh token lifespan in days",
    )

    # CORS Configuration
    CORS_ORIGINS: Annotated[List[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
        ],
        description="Allowed CORS origin URLs",
    )

    CORS_ORIGIN_REGEX: str = Field(
        default="",
        description=(
            "Optional regex for extra allowed origins (e.g. Vercel preview URLs of YOUR project only: "
            "'https://mv-greentech-payment(-[a-z0-9-]+)?\\.vercel\\.app'). Empty = disabled."
        ),
    )

    # Initial Bootstrap (first Super Admin, created on startup only when the users table is empty)
    FIRST_SUPERADMIN_EMAIL: str = Field(default="", description="Email for the first super admin")
    FIRST_SUPERADMIN_PASSWORD: str = Field(default="", description="Initial password for the first super admin")
    FIRST_SUPERADMIN_NAME: str = Field(default="System Administrator", description="Display name of first super admin")
    SETUP_TOKEN: str = Field(
        default="",
        description="Secret required by POST /api/setup/init. In production, /init is disabled when this is empty.",
    )

    # File Storage Configuration
    UPLOAD_DIR: str = Field(
        default="./uploads",
        description="Absolute or relative path to store uploaded files securely",
    )
    MAX_UPLOAD_SIZE: int = Field(
        default=10 * 1024 * 1024,  # 10 MB in bytes
        description="Maximum file upload size in bytes (default: 10MB)",
    )
    ALLOWED_EXTENSIONS: Annotated[List[str], NoDecode] = Field(
        default_factory=lambda: ["pdf", "jpg", "jpeg", "png", "xlsx"],
        description="List of permitted file extensions for uploads",
    )

    # SMTP / Email Configuration
    SMTP_HOST: str = Field(default="smtp.gmail.com", description="SMTP server host")
    SMTP_PORT: int = Field(default=587, description="SMTP server port (e.g., 587 for TLS, 465 for SSL)")
    SMTP_USER: str = Field(default="", description="SMTP username/email")
    SMTP_PASSWORD: str = Field(default="", description="SMTP password or app-specific password")
    SMTP_FROM: str = Field(default="noreply@mvpayment.com", description="Default sender email address")

    # Redis & Celery Configuration
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL for caching and task broker",
    )

    # Pydantic Settings configuration dict
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def ensure_asyncpg_database_url(cls, v: Any) -> str:
        """
        Ensures the database URL uses postgresql+asyncpg for async SQLAlchemy.
        """
        if isinstance(v, str):
            v_clean = v.strip()
            if v_clean.startswith("postgresql://") and not v_clean.startswith("postgresql+asyncpg://"):
                return v_clean.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif v_clean.startswith("postgres://"):
                return v_clean.replace("postgres://", "postgresql+asyncpg://", 1)
            return v_clean
        return str(v)

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> List[str]:
        """
        Parses CORS origins from JSON list or comma-separated string.
        """
        if isinstance(v, str):
            v_strip = v.strip()
            if v_strip.startswith("[") and v_strip.endswith("]"):
                try:
                    parsed = json.loads(v_strip)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except Exception:
                    pass
            return [origin.strip() for origin in v_strip.split(",") if origin.strip()]
        elif isinstance(v, (list, tuple)):
            return [str(origin).strip() for origin in v if str(origin).strip()]
        return v

    @field_validator("ALLOWED_EXTENSIONS", mode="before")
    @classmethod
    def parse_allowed_extensions(cls, v: Any) -> List[str]:
        """
        Parses allowed extensions, stripping leading dots and normalizing to lowercase.
        """
        if isinstance(v, str):
            v_strip = v.strip()
            if v_strip.startswith("[") and v_strip.endswith("]"):
                try:
                    parsed = json.loads(v_strip)
                    if isinstance(parsed, list):
                        return [str(ext).strip().lstrip(".").lower() for ext in parsed if str(ext).strip()]
                except Exception:
                    pass
            return [ext.strip().lstrip(".").lower() for ext in v_strip.split(",") if ext.strip()]
        elif isinstance(v, (list, tuple)):
            return [str(ext).strip().lstrip(".").lower() for ext in v if str(ext).strip()]
        return v

    def validate_production_secrets(self) -> None:
        """Refuse to start in production with default or weak secrets."""
        if not self.is_production:
            return
        problems = []
        for name in ("SECRET_KEY", "JWT_SECRET_KEY"):
            value = getattr(self, name)
            if "change-in-production" in value or len(value) < 32:
                problems.append(name)
        if problems:
            raise RuntimeError(
                "Insecure configuration: set strong (32+ chars) values for "
                + ", ".join(problems)
                + " in production."
            )

    @property
    def is_production(self) -> bool:
        """Check if environment is production."""
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_development(self) -> bool:
        """Check if environment is development."""
        return self.ENVIRONMENT.lower() == "development"

    @property
    def upload_path(self) -> Path:
        """Return the Path object for UPLOAD_DIR and ensure it exists."""
        path = Path(self.UPLOAD_DIR).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache()
def get_settings() -> Settings:
    """
    Cached getter for application Settings.
    Utilizes lru_cache so settings are loaded only once.
    """
    return Settings()

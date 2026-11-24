"""
Security and Authentication Utilities Module.

Provides functions for password hashing (argon2id), JWT token creation and decoding,
request reference number generation, secure filename creation, and upload validation.
"""

from datetime import datetime, timedelta, timezone
import logging
import os
from pathlib import Path
import re
from typing import Any, Dict, Optional, Tuple, Union
import uuid

from fastapi import HTTPException, UploadFile, status

try:
    import argon2
    _argon2_hasher = argon2.PasswordHasher(
        time_cost=3,
        memory_cost=65536,
        parallelism=4,
        type=argon2.Type.ID,
    )
except ImportError:
    _argon2_hasher = None

try:
    from passlib.context import CryptContext
    # Configure passlib with Argon2 (Argon2id default via argon2-cffi)
    pwd_context = CryptContext(
        schemes=["argon2"],
        deprecated="auto",
    )
except Exception:
    pwd_context = None

try:
    from jose import JWTError, jwt
    from jose.exceptions import ExpiredSignatureError
except ImportError:
    JWTError = Exception
    ExpiredSignatureError = Exception
    jwt = None

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Magic bytes signature dictionary for supported file extensions
MAGIC_BYTES = {
    "pdf": [b"%PDF-"],
    "jpg": [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "xlsx": [b"PK\x03\x04"],  # ZIP container header for Office Open XML
}

# Standard MIME type mappings
MIME_TYPE_MAPPINGS = {
    "pdf": ["application/pdf"],
    "jpg": ["image/jpeg", "image/pjpeg"],
    "jpeg": ["image/jpeg", "image/pjpeg"],
    "png": ["image/png"],
    "xlsx": [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/octet-stream",
        "application/zip",
    ],
}


def hash_password(password: str) -> str:
    """
    Hashes a plain-text password using Argon2id.

    Args:
        password: The plain-text password string.

    Returns:
        The hashed password string.
    """
    if not password:
        raise ValueError("Password cannot be empty.")
    if _argon2_hasher is not None:
        return _argon2_hasher.hash(password)
    if pwd_context is not None:
        return pwd_context.hash(password)
    raise RuntimeError("Neither argon2-cffi nor passlib is installed/configured.")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against an Argon2 hashed password.

    Args:
        plain_password: The plain-text password to check.
        hashed_password: The stored Argon2 hash.

    Returns:
        True if the password matches the hash, False otherwise.
    """
    if not plain_password or not hashed_password:
        return False
    if _argon2_hasher is not None and hashed_password.startswith("$argon2"):
        try:
            return _argon2_hasher.verify(hashed_password, plain_password)
        except Exception:
            return False
    if pwd_context is not None:
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception as exc:
            logger.warning("Password verification error: %s", exc)
            return False
    return False


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Generates a signed JWT access token.

    Args:
        data: Payload dictionary to encode in the token.
        expires_delta: Optional custom expiration duration. Defaults to settings.ACCESS_TOKEN_EXPIRE_MINUTES.

    Returns:
        Encoded JWT token string.
    """
    if jwt is None:
        raise RuntimeError("python-jose is not installed or configured.")

    to_encode = data.copy()
    now = datetime.now(timezone.utc)

    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "nbf": now,
        "type": "access",
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def create_refresh_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Generates a signed JWT refresh token with extended lifespan.

    Args:
        data: Payload dictionary to encode.
        expires_delta: Optional custom expiration duration. Defaults to settings.REFRESH_TOKEN_EXPIRE_DAYS.

    Returns:
        Encoded JWT refresh token string.
    """
    if jwt is None:
        raise RuntimeError("python-jose is not installed or configured.")

    to_encode = data.copy()
    now = datetime.now(timezone.utc)

    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "nbf": now,
        "type": "refresh",
        "jti": str(uuid.uuid4()),
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def decode_token(token: str) -> Dict[str, Any]:
    """
    Decodes and validates a JWT token using application settings.

    Args:
        token: Encoded JWT string.

    Returns:
        Decoded payload dictionary.

    Raises:
        HTTPException: 401 Unauthorized if token is expired, invalid, or malformed.
    """
    if jwt is None:
        raise RuntimeError("python-jose is not installed or configured.")

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except ExpiredSignatureError:
        logger.info("Provided JWT token has expired.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please authenticate again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise credentials_exception


def generate_request_number(
    prefix: str = "PR",
    year: Optional[int] = None,
    sequence: int = 1,
) -> str:
    """
    Generates a formatted payment request number (e.g., PR-2026-00001).

    Args:
        prefix: Prefix string identifying the document type (default: "PR").
        year: Year for the sequence. Defaults to current UTC year.
        sequence: Monotonically increasing integer sequence counter.

    Returns:
        Standardized reference number string.
    """
    if year is None:
        year = datetime.now(timezone.utc).year

    # Ensure clean alphanumeric uppercase prefix
    clean_prefix = re.sub(r"[^A-Za-z0-9]", "", prefix).upper() or "PR"
    return f"{clean_prefix}-{year}-{sequence:05d}"


def generate_secure_filename(original_name: str) -> str:
    """
    Generates a sanitized, collision-resistant secure filename.
    Protects against directory traversal, shell injection, and duplicate file overwrites.

    Args:
        original_name: The original filename received from the client.

    Returns:
        A unique, safe filename string (e.g. 550e8400e29b41d4a716446655440000_1711234567_invoice.pdf).
    """
    # Extract only the base name and strip path components
    base_name = os.path.basename(original_name)
    path_obj = Path(base_name)
    stem = path_obj.stem
    ext = path_obj.suffix.lower()

    # Sanitize stem: replace non-alphanumeric characters with underscores
    clean_stem = re.sub(r"[^a-zA-Z0-9_-]", "_", stem).strip("._")
    if not clean_stem:
        clean_stem = "file"

    # Truncate clean_stem if too long (max 40 chars)
    clean_stem = clean_stem[:40]

    unique_id = uuid.uuid4().hex
    timestamp = int(datetime.now(timezone.utc).timestamp())

    return f"{unique_id}_{timestamp}_{clean_stem}{ext}"


async def validate_file_upload(
    file: UploadFile,
    max_size: Optional[int] = None,
    allowed_extensions: Optional[list] = None,
    raise_exception: bool = True,
) -> Tuple[bool, Optional[str]]:
    """
    Validates an uploaded file for size, permitted extension, and MIME type / magic bytes.

    Args:
        file: FastAPI UploadFile object.
        max_size: Maximum allowed bytes. Defaults to settings.MAX_UPLOAD_SIZE.
        allowed_extensions: Permitted extension list. Defaults to settings.ALLOWED_EXTENSIONS.
        raise_exception: If True, raises HTTPException on validation failure; otherwise returns (False, error_msg).

    Returns:
        Tuple of (is_valid: bool, error_message: Optional[str]).

    Raises:
        HTTPException: 400 Bad Request if file fails validation and raise_exception is True.
    """
    if not file or not file.filename:
        err = "No file provided or filename is missing."
        if raise_exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
        return False, err

    max_bytes = max_size if max_size is not None else settings.MAX_UPLOAD_SIZE
    valid_exts = [
        ext.lower().lstrip(".") for ext in (allowed_extensions or settings.ALLOWED_EXTENSIONS)
    ]

    # 1. Validate Extension
    file_ext = Path(file.filename).suffix.lower().lstrip(".")
    if not file_ext or file_ext not in valid_exts:
        err = (
            f"File extension '.{file_ext}' is not permitted. "
            f"Allowed extensions: {', '.join(valid_exts)}."
        )
        if raise_exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
        return False, err

    # 2. Validate MIME Type reported by client
    client_content_type = (file.content_type or "").lower().strip()
    expected_mimes = MIME_TYPE_MAPPINGS.get(file_ext, [])
    if expected_mimes and client_content_type:
        # Check if client mime matches or is generic stream
        if client_content_type not in expected_mimes and client_content_type != "application/octet-stream":
            logger.warning(
                "Suspicious MIME type mismatch: filename='%s', ext='%s', reported_mime='%s'",
                file.filename,
                file_ext,
                client_content_type,
            )

    # 3. Read Header & Check File Size and Magic Bytes
    try:
        # Check size if available directly
        if hasattr(file, "size") and file.size is not None and file.size > max_bytes:
            err = f"File size exceeds maximum permitted limit of {max_bytes / (1024 * 1024):.1f}MB."
            if raise_exception:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
            return False, err

        # Read first 16 bytes for magic bytes verification
        header = await file.read(16)
        if not header:
            err = "Uploaded file is empty (0 bytes)."
            if raise_exception:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
            return False, err

        # Verify magic byte signatures for known extensions
        magic_candidates = MAGIC_BYTES.get(file_ext, [])
        if magic_candidates:
            matches_magic = any(header.startswith(sig) for sig in magic_candidates)
            if not matches_magic:
                err = f"File content does not match the expected format for '.{file_ext}'."
                if raise_exception:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
                return False, err

        # Seek to end to calculate exact size if not provided by file.size
        file.file.seek(0, os.SEEK_END)
        total_size = file.file.tell()
        file.file.seek(0)
        if total_size > max_bytes:
            err = f"File size ({total_size / (1024 * 1024):.2f}MB) exceeds limit of {max_bytes / (1024 * 1024):.1f}MB."
            if raise_exception:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
            return False, err

        # Rewind file pointer for subsequent processing
        await file.seek(0)
        return True, None

    except HTTPException:
        try:
            await file.seek(0)
        except Exception:
            pass
        raise
    except Exception as exc:
        try:
            await file.seek(0)
        except Exception:
            pass
        err = f"Failed to validate file: {str(exc)}"
        logger.error("Error validating upload '%s': %s", file.filename, exc, exc_info=True)
        if raise_exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
        return False, err

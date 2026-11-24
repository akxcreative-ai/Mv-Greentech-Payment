"""
File Management and Storage Utilities.

Handles secure asynchronous saving, deletion, path resolution with traversal protection,
signed temporary URL generation (itsdangerous), and MIME type validation.
Files are stored exclusively in private storage directories, never in public/static folders.
"""

import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional, Union

from fastapi import HTTPException, UploadFile, status

try:
    import aiofiles
except ImportError:
    aiofiles = None

try:
    from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
except ImportError:
    BadSignature = Exception
    SignatureExpired = Exception
    URLSafeTimedSerializer = None

from app.config import get_settings
from app.utils.security import MAGIC_BYTES, MIME_TYPE_MAPPINGS, generate_secure_filename

logger = logging.getLogger(__name__)
settings = get_settings()

SIGNED_URL_SALT = "mv-payment-file-download-salt"


def _get_serializer() -> Any:
    """Internal helper to instantiate itsdangerous URLSafeTimedSerializer."""
    if URLSafeTimedSerializer is None:
        raise RuntimeError("itsdangerous package is not installed.")
    return URLSafeTimedSerializer(settings.SECRET_KEY, salt=SIGNED_URL_SALT)


def get_file_path(filename: str, upload_dir: Optional[str] = None) -> Path:
    """
    Safely resolves the file path within the private upload directory,
    strictly preventing directory traversal attacks.

    Args:
        filename: Name of the file to resolve.
        upload_dir: Optional base directory. Defaults to settings.UPLOAD_DIR.

    Returns:
        Path object pointing to the file.

    Raises:
        HTTPException: 403 Forbidden if path traversal attempt is detected.
    """
    base_dir = Path(upload_dir or settings.UPLOAD_DIR).resolve()
    # Resolve target path
    clean_filename = os.path.basename(filename.strip().replace("\\", "/"))
    target_path = (base_dir / clean_filename).resolve()

    # Validate that target_path is within base_dir
    try:
        if not target_path.is_relative_to(base_dir):
            logger.error("Path traversal attempt detected: filename='%s'", filename)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Invalid file path specified.",
            )
    except AttributeError:
        # Fallback for older python or edge paths
        if not str(target_path).startswith(str(base_dir)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Invalid file path specified.",
            )

    return target_path


async def validate_mime_type(file: UploadFile) -> str:
    """
    Inspects magic bytes of an uploaded file to strictly validate and determine its MIME type.

    Args:
        file: UploadFile object.

    Returns:
        Validated MIME type string.

    Raises:
        HTTPException: 400 Bad Request if file format or magic signature is invalid.
    """
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided or filename is missing.",
        )

    file_ext = Path(file.filename).suffix.lower().lstrip(".")
    if not file_ext or file_ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension '.{file_ext}' is not permitted.",
        )

    # Read first 16 bytes for magic bytes verification
    try:
        header = await file.read(16)
        await file.seek(0)
    except Exception as exc:
        logger.error("Failed to read file header for '%s': %s", file.filename, exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to inspect uploaded file contents.",
        )

    if not header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    magic_signatures = MAGIC_BYTES.get(file_ext, [])
    if magic_signatures:
        if not any(header.startswith(sig) for sig in magic_signatures):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File content does not match the expected signature for '.{file_ext}'.",
            )

    # Map to standard canonical MIME type
    canonical_mimes = MIME_TYPE_MAPPINGS.get(file_ext, ["application/octet-stream"])
    return canonical_mimes[0]


async def save_upload(
    file: UploadFile,
    upload_dir: Optional[str] = None,
) -> str:
    """
    Asynchronously saves an uploaded file into the private storage directory in chunks.
    Ensures safe filenames, directory isolation, and cleans up partial writes on error.

    Args:
        file: FastAPI UploadFile instance.
        upload_dir: Target directory path. Defaults to settings.UPLOAD_DIR.

    Returns:
        The absolute file path string where the file is securely saved.

    Raises:
        HTTPException: 500 Internal Server Error if write operation fails.
    """
    # Ensure target private directory exists
    target_dir = Path(upload_dir or settings.UPLOAD_DIR).resolve()
    target_dir.mkdir(parents=True, exist_ok=True)

    # Generate a unique, cryptographically secure filename
    secure_name = generate_secure_filename(file.filename or "upload.bin")
    destination_path = target_dir / secure_name

    logger.info("Saving uploaded file '%s' as '%s'", file.filename, destination_path)

    try:
        # Stream file to disk in 64KB chunks to maintain low memory profile
        if aiofiles is not None:
            async with aiofiles.open(destination_path, "wb") as buffer:
                while chunk := await file.read(64 * 1024):
                    await buffer.write(chunk)
        else:
            # Fallback if aiofiles not available
            with open(destination_path, "wb") as buffer:
                while chunk := await file.read(64 * 1024):
                    buffer.write(chunk)

        # Rewind original file pointer in case needed downstream
        await file.seek(0)
        return str(destination_path.as_posix())

    except Exception as exc:
        logger.error("Failed to save file '%s': %s", destination_path, exc, exc_info=True)
        # Clean up incomplete file on error
        if destination_path.exists():
            try:
                destination_path.unlink()
            except OSError:
                pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save uploaded file to storage: {str(exc)}",
        )


def delete_file(file_path: Union[str, Path]) -> bool:
    """
    Safely deletes a file from disk if it exists.

    Args:
        file_path: Path to the file to delete.

    Returns:
        True if the file was deleted, False if it did not exist or could not be removed.
    """
    try:
        path_obj = Path(file_path).resolve()
        if path_obj.is_file():
            path_obj.unlink()
            logger.info("Successfully deleted file: %s", path_obj)
            return True
        else:
            logger.warning("File deletion skipped; path does not exist or is not a file: %s", file_path)
            return False
    except Exception as exc:
        logger.error("Error deleting file '%s': %s", file_path, exc, exc_info=True)
        return False


def generate_signed_url(file_path: str, expires_in: int = 3600) -> str:
    """
    Generates a cryptographically signed, time-limited URL for secure file download.
    Never exposes raw filesystem paths directly.

    Args:
        file_path: Absolute or relative storage path of the file.
        expires_in: Expiration lifetime in seconds (default: 3600 = 1 hour).

    Returns:
        Fully qualified signed URL string.
    """
    serializer = _get_serializer()
    filename = os.path.basename(file_path)

    payload = {
        "file_path": str(file_path),
        "filename": filename,
    }

    # Generate timed token
    token = serializer.dumps(payload)

    # Return full download URL
    base_url = settings.APP_URL.rstrip("/")
    signed_url = f"{base_url}/api/v1/files/download?token={token}"
    return signed_url


def verify_signed_url_token(token: str, max_age: int = 3600) -> Dict[str, Any]:
    """
    Verifies and decodes a signed download token.

    Args:
        token: Cryptographic token from signed URL.
        max_age: Maximum token age in seconds.

    Returns:
        Decoded payload dict containing file_path and filename.

    Raises:
        HTTPException: 401 if expired, 400 if invalid or tampered.
    """
    serializer = _get_serializer()
    try:
        payload: Dict[str, Any] = serializer.loads(token, max_age=max_age)
        return payload
    except SignatureExpired:
        logger.warning("Signed download URL token has expired.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The download link has expired. Please request a new link.",
        )
    except BadSignature as exc:
        logger.warning("Invalid signed download URL signature: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or tampered download token.",
        )

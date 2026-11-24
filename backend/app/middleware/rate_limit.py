"""
Rate Limiting Middleware and Utilities.

Configures SlowAPI rate limiting with IP-based identification,
differentiated rate tiers (e.g. strict for authentication, standard for general APIs),
and standardized 429 Too Many Requests response handling.
"""

import logging
from typing import Optional

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings

logger = logging.getLogger("mv-payment-approval.rate_limit")
settings = get_settings()


def get_client_ip(request: Request) -> str:
    """
    Extracts the true client IP address, prioritizing standard proxy/reverse-proxy
    headers (CF-Connecting-IP, X-Forwarded-For, X-Real-IP) before falling back to request.client.
    """
    # 1. Cloudflare header
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip.strip()

    # 2. X-Forwarded-For (take the first IP in the comma-delimited chain)
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        client_ip = x_forwarded_for.split(",")[0].strip()
        if client_ip:
            return client_ip

    # 3. X-Real-IP
    x_real_ip = request.headers.get("X-Real-IP")
    if x_real_ip:
        return x_real_ip.strip()

    # 4. Fallback to direct client host or SlowAPI default
    try:
        remote = get_remote_address(request)
        if remote:
            return remote
    except Exception:
        pass

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


# Defined rate limit threshold constants
LOGIN_RATE_LIMIT = "5/minute"
PASSWORD_RESET_RATE_LIMIT = "3/minute"
API_DEFAULT_RATE_LIMIT = "100/minute"
UPLOAD_RATE_LIMIT = "20/minute"
EXPORT_RATE_LIMIT = "10/minute"

# Shared Limiter instance
limiter = Limiter(
    key_func=get_client_ip,
    default_limits=[API_DEFAULT_RATE_LIMIT],
    headers_enabled=True,
    strategy="fixed-window",
)


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """
    Custom exception handler for RateLimitExceeded errors.
    Returns standard JSON error envelope with Retry-After header.
    """
    client_ip = get_client_ip(request)
    logger.warning(
        "Rate limit exceeded for IP %s on %s %s: %s",
        client_ip,
        request.method,
        request.url.path,
        exc.detail,
    )

    response = JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "success": False,
            "error": "Too Many Requests",
            "message": f"Rate limit exceeded: {exc.detail}. Please retry after a brief delay.",
        },
    )
    try:
        if hasattr(request.state, "view_rate_limit"):
            response = limiter._inject_headers(response, request.state.view_rate_limit)
    except Exception:
        pass

    if "Retry-After" not in response.headers and "retry-after" not in response.headers:
        response.headers["Retry-After"] = "60"
    return response

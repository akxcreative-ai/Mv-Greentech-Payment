"""
Security and Request Tracing Middleware.

Provides:
- SecurityHeadersMiddleware: injects robust enterprise HTTP security headers
  (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy).
- RequestLoggingMiddleware: logs all incoming requests, status codes, and execution duration.
- TrustedHost configuration utilities.
"""

from datetime import datetime, timezone
import logging
import time
from typing import Callable, List, Optional
import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.types import ASGIApp

from app.config import get_settings

logger = logging.getLogger("mv-payment-approval.security")
settings = get_settings()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware that appends security-hardening HTTP response headers
    to guard against clickjacking, MIME sniffing, XSS, and downgrade attacks.
    """

    def __init__(
        self,
        app: ASGIApp,
        enable_hsts: bool = True,
        hsts_max_age: int = 31536000,
        hsts_include_subdomains: bool = True,
        hsts_preload: bool = False,
        content_security_policy: Optional[str] = None,
    ):
        super().__init__(app)
        self.enable_hsts = enable_hsts
        self.hsts_header_val = f"max-age={hsts_max_age}"
        if hsts_include_subdomains:
            self.hsts_header_val += "; includeSubDomains"
        if hsts_preload:
            self.hsts_header_val += "; preload"

        self.csp_header_val = (
            content_security_policy
            if content_security_policy is not None
            else (
                "default-src 'self'; "
                "img-src 'self' data: blob:; "
                "style-src 'self' 'unsafe-inline'; "
                "script-src 'self' 'unsafe-inline'; "
                "font-src 'self' data:; "
                "connect-src 'self' http: https: ws: wss:; "
                "frame-ancestors 'none';"
            )
        )

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        # 1. Prevent Clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # 2. Prevent MIME-type confusion
        response.headers["X-Content-Type-Options"] = "nosniff"

        # 3. Legacy XSS filter activation
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # 4. Strict Transport Security (HSTS) in non-local or production modes
        if self.enable_hsts:
            response.headers["Strict-Transport-Security"] = self.hsts_header_val

        # 5. Content Security Policy
        response.headers["Content-Security-Policy"] = self.csp_header_val

        # 6. Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # 7. Permissions Policy (Disables unused browser hardware capabilities)
        response.headers["Permissions-Policy"] = (
            "geolocation=(), camera=(), microphone=(), payment=(), usb=(), accelerometer=()"
        )

        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for structured request logging and latency measurement.
    Attaches a unique Request-ID header to every response for end-to-end tracing.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start_time = time.perf_counter()

        # Capture or assign unique correlation request ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        client_host = request.client.host if request.client else "unknown"
        method = request.method
        url_path = request.url.path

        # Process the request
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            logger.error(
                "Request failed: %s %s [%s] from %s - error: %s (%.2f ms)",
                method,
                url_path,
                request_id,
                client_host,
                exc,
                duration_ms,
                exc_info=True,
            )
            raise

        duration_ms = (time.perf_counter() - start_time) * 1000.0
        response.headers["X-Request-ID"] = request_id

        # Skip high-frequency health probes from spamming default info logs
        if url_path in ("/health", "/api/v1/health", "/api/health"):
            logger.debug(
                "%s %s %d - %.2f ms (req_id=%s, ip=%s)",
                method,
                url_path,
                status_code,
                duration_ms,
                request_id,
                client_host,
            )
        else:
            logger.info(
                "%s %s %d - %.2f ms (req_id=%s, ip=%s)",
                method,
                url_path,
                status_code,
                duration_ms,
                request_id,
                client_host,
            )

        return response


def get_trusted_hosts() -> List[str]:
    """
    Returns list of trusted hosts allowed to connect to this API.
    Can be configured via settings or environment.
    """
    # Allow localhost, 127.0.0.1, and configured domain hosts
    hosts = ["localhost", "127.0.0.1", "::1", "testserver"]
    app_url = getattr(settings, "APP_URL", "")
    if app_url:
        try:
            from urllib.parse import urlparse
            netloc = urlparse(app_url).netloc.split(":")[0]
            if netloc and netloc not in hosts:
                hosts.append(netloc)
        except Exception:
            pass

    # In production, specific wildcards or subdomains can be configured
    if settings.is_development:
        hosts.append("*")

    return hosts

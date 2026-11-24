"""
MV Payment Approval System - Main FastAPI Application.

Configures:
- Application metadata, OpenAPI docs, and lifespan events
- Enterprise security headers middleware and request tracing
- Strict Cross-Origin Resource Sharing (CORS)
- IP-based rate limiting via SlowAPI
- Standardized API router aggregation (/api)
- Health probe endpoints for orchestrators
- Production-grade exception handlers (preventing stack trace leaks)
"""

from contextlib import asynccontextmanager
import logging
import sys
from typing import List

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import api_router
from app.api.setup import ensure_default_roles
from app.config import get_settings
from app.database import AsyncSessionLocal, close_db, init_db
from app.middleware.rate_limit import limiter, rate_limit_exceeded_handler
from app.middleware.security import RequestLoggingMiddleware, SecurityHeadersMiddleware

settings = get_settings()

# Setup structured console logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("mv-payment-approval")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager for startup bootstrapping and shutdown disposal.
    """
    logger.info("Bootstrapping %s in [%s] mode...", settings.APP_NAME, settings.ENVIRONMENT)

    # 1. Initialize schema and default roles
    try:
        await init_db()
        async with AsyncSessionLocal() as session:
            await ensure_default_roles(session)
            await session.commit()
        logger.info("Database schema and core roles verified.")
    except Exception as exc:
        logger.warning("Database bootstrap notice (may be normal if migrations run separately): %s", exc)

    yield

    # 2. Cleanup resources
    logger.info("Shutting down %s...", settings.APP_NAME)
    await close_db()
    logger.info("Shutdown complete.")


# Initialize FastAPI Application
app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise Multi-Tier Payment Voucher & Approval System API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Attach SlowAPI rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


# --------------------------------------------------------------------------
# Middleware Configuration (Executed in reverse order of addition)
# --------------------------------------------------------------------------

# 1. Request logging & correlation tracing
app.add_middleware(RequestLoggingMiddleware)

# 2. Security hardening headers (CSP, HSTS, X-Content-Type, X-Frame-Options)
app.add_middleware(
    SecurityHeadersMiddleware,
    enable_hsts=settings.is_production,
)

# 3. Cross-Origin Resource Sharing (CORS)
cors_origins = settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "Content-Disposition", "Retry-After"],
)


# --------------------------------------------------------------------------
# Exception Handlers (Production Safe: No Internal Stack Traces)
# --------------------------------------------------------------------------

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Standardizes request validation failures into 422 JSON envelopes."""
    errors = []
    for err in exc.errors():
        loc = " -> ".join(str(item) for item in err.get("loc", []))
        errors.append({
            "field": loc,
            "message": err.get("msg", "Invalid value"),
            "type": err.get("type", "value_error"),
        })

    logger.warning("Validation failure on %s %s: %s", request.method, request.url.path, errors)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": "Validation Error",
            "message": "Input validation failed. Please check the supplied attributes.",
            "details": errors,
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Formats standard HTTP errors with consistent JSON envelopes."""
    headers = getattr(exc, "headers", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": "HTTP Error",
            "message": str(exc.detail),
            "status_code": exc.status_code,
        },
        headers=headers,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Catches all unexpected internal errors.
    CRITICAL: Never leaks internal exception details or stack traces in production.
    """
    req_id = getattr(request.state, "request_id", "unknown")
    logger.error(
        "Unhandled 500 error on %s %s [Req-ID: %s]: %s",
        request.method,
        request.url.path,
        req_id,
        exc,
        exc_info=True,
    )

    error_message = (
        str(exc)
        if settings.is_development
        else "An internal server error occurred. Please contact system support."
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "Internal Server Error",
            "message": error_message,
            "request_id": req_id,
        },
    )


# --------------------------------------------------------------------------
# Route Inclusions & Health Check Endpoints
# --------------------------------------------------------------------------

# Mount all domain endpoints under /api
app.include_router(api_router)


@app.get("/health", status_code=status.HTTP_200_OK, tags=["Health"])
@app.get("/api/health", status_code=status.HTTP_200_OK, tags=["Health"])
@app.get("/api/v1/health", status_code=status.HTTP_200_OK, tags=["Health"])
async def health_check():
    """Liveness probe for cloud load balancers and container monitors."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0",
    }


@app.get("/", status_code=status.HTTP_200_OK, tags=["Root"])
async def root():
    """Root entrypoint with API documentation references."""
    return {
        "service": settings.APP_NAME,
        "status": "online",
        "docs": "/docs",
        "health": "/health",
        "api_root": "/api",
    }

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

        # Ensure default MV Greentech production accounts exist on any cold start / restart
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select, func
            from app.models.user import User
            from app.models.company import Company
            from app.models.department import Department
            from app.models.role import Role, RoleEnum
            from app.utils.security import hash_password

            user_count = (await session.execute(select(func.count(User.id)))).scalar() or 0
            if user_count == 0:
                comp_q = await session.execute(select(Company).where(Company.code == "MVG-01"))
                comp = comp_q.scalar_one_or_none()
                if not comp:
                    comp = Company(
                        name="MV Greentech",
                        code="MVG-01",
                        address="Gurugram, Haryana, India",
                        phone="+91-124-4567890",
                        email="info@mvgreentech.com",
                        gst_number="06AAAAA0000A1Z5",
                        pan_number="AAAAA0000A",
                        primary_color="#0D5C3A",
                        is_active=True
                    )
                    session.add(comp)
                    await session.flush()

                departments = {}
                for dept_name, code in [
                    ("Accounts & Finance", "FIN-01"),
                    ("Operations", "OPS-01"),
                    ("Procurement", "PROC-01"),
                    ("Management", "MGMT-01"),
                ]:
                    d_q = await session.execute(
                        select(Department).where(Department.company_id == comp.id, Department.code == code)
                    )
                    dept = d_q.scalar_one_or_none()
                    if not dept:
                        dept = Department(company_id=comp.id, name=dept_name, code=code, is_active=True)
                        session.add(dept)
                        await session.flush()
                    departments[code] = dept

                roles = {}
                for r_name in [RoleEnum.SUPER_ADMIN, RoleEnum.DIRECTOR, RoleEnum.ACCOUNTANT, RoleEnum.DEPARTMENT_HEAD]:
                    res_r = await session.execute(select(Role).where(Role.name == r_name.value))
                    roles[r_name.value] = res_r.scalar_one()

                users_to_create = [
                    {"email": "admin@mvgreentech.com", "password": "Admin@MVGreentech2026", "first_name": "System", "last_name": "Admin", "role_name": RoleEnum.SUPER_ADMIN.value, "dept_code": "MGMT-01", "phone": "+91-9876543210"},
                    {"email": "approver@mvgreentech.com", "password": "Approver@MVGreentech2026", "first_name": "Executive", "last_name": "Approver", "role_name": RoleEnum.DIRECTOR.value, "dept_code": "MGMT-01", "phone": "+91-9876543211"},
                    {"email": "accountant@mvgreentech.com", "password": "Accountant@MVGreentech2026", "first_name": "Finance", "last_name": "Accountant", "role_name": RoleEnum.ACCOUNTANT.value, "dept_code": "FIN-01", "phone": "+91-9876543212"},
                    {"email": "requester@mvgreentech.com", "password": "Requester@MVGreentech2026", "first_name": "Operations", "last_name": "Requester", "role_name": RoleEnum.DEPARTMENT_HEAD.value, "dept_code": "OPS-01", "phone": "+91-9876543213"}
                ]

                for u_data in users_to_create:
                    u = User(
                        company_id=comp.id,
                        department_id=departments[u_data["dept_code"]].id,
                        role_id=roles[u_data["role_name"]].id,
                        email=u_data["email"],
                        password_hash=hash_password(u_data["password"]),
                        first_name=u_data["first_name"],
                        last_name=u_data["last_name"],
                        phone=u_data["phone"],
                        is_active=True,
                        email_verified=True,
                    )
                    session.add(u)
                await session.commit()
                logger.info("Automatic startup bootstrap of 4 core accounts completed.")
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
    allow_origin_regex=r"https://.*\.vercel\.app",
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

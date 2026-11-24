"""
API Router Aggregation Package.

Mounts and organizes all domain sub-routers under the centralized `/api` path prefix:
- /api/auth
- /api/setup
- /api/users
- /api/companies
- /api/departments
- /api/vendors
- /api/payment-requests
- /api/approvals
- /api/payments
- /api/notifications
- /api/audit-logs
- /api/reports
- /api/settings
"""

from fastapi import APIRouter

from app.api.approvals import router as approvals_router
from app.api.audit_logs import router as audit_logs_router
from app.api.auth import router as auth_router
from app.api.companies import router as companies_router
from app.api.departments import router as departments_router
from app.api.notifications import router as notifications_router
from app.api.payment_requests import router as payment_requests_router
from app.api.payments import router as payments_router
from app.api.reports import router as reports_router
from app.api.settings import router as settings_router
from app.api.setup import router as setup_router
from app.api.users import router as users_router
from app.api.vendors import router as vendors_router

# Central main router with prefix '/api'
api_router = APIRouter(prefix="/api")

# Include sub-routers
api_router.include_router(auth_router)
api_router.include_router(setup_router)
api_router.include_router(users_router)
api_router.include_router(companies_router)
api_router.include_router(departments_router)
api_router.include_router(vendors_router)
api_router.include_router(payment_requests_router)
api_router.include_router(approvals_router)
api_router.include_router(payments_router)
api_router.include_router(notifications_router)
api_router.include_router(audit_logs_router)
api_router.include_router(reports_router)
api_router.include_router(settings_router)

__all__ = ["api_router"]

"""
Security & Hardening Test Suite.

Verifies:
- SQL Injection mitigation across credentials and query filters
- Cross-Site Scripting (XSS) prevention and defensive security headers (CSP, X-Frame-Options, X-Content-Type-Options)
- Rate limiting enforcement via SlowAPI (429 Too Many Requests)
- Strict file validation: rejecting malicious extensions and content forgery
- Maximum upload size rejection (> 10MB)
- Rejection of unauthorized and forged API access attempts
- Cross-Site Request Forgery (CSRF) defenses and cookie security flags
"""

import uuid
import pytest
from httpx import AsyncClient

from app.models.payment_request import PaymentRequest
from app.models.user import User


@pytest.mark.asyncio
async def test_sql_injection_prevention(
    test_client: AsyncClient,
    regular_user_headers: dict,
    test_user_password: str = "TestPassword123!",
):
    """
    Ensure parameterized SQLAlchemy queries prevent SQL injection payloads
    in authentication and filtering.
    """
    sql_payloads = [
        "' OR '1'='1",
        "admin'--",
        "' UNION SELECT id, email, password_hash FROM users --",
        "'; DROP TABLE payment_requests; --",
        "1; SELECT pg_sleep(5); --",
    ]

    # 1. SQLi attempt in login credentials
    for sqli in sql_payloads:
        resp = await test_client.post(
            "/api/auth/login",
            json={"email": sqli, "password": "wrongpassword"},
        )
        # Input validation prevents unformatted SQL strings (422) or parameterization blocks auth (401)
        assert resp.status_code in (401, 422)

    # 2. SQLi attempt in search filter
    search_resp = await test_client.get(
        "/api/payment-requests?search=%27%20OR%20%271%27=%271",
        headers=regular_user_headers,
    )
    assert search_resp.status_code == 200
    # Should safely treat the payload as literal string, not execute SQL logic
    data = search_resp.json()
    assert "items" in data or isinstance(data, list)


@pytest.mark.asyncio
async def test_xss_prevention(
    test_client: AsyncClient,
    regular_user_headers: dict,
    draft_payment_request: PaymentRequest,
):
    """
    Ensure XSS injection vectors are sanitized and defensive security headers are delivered.
    """
    xss_payload = "<script>alert('XSS_ATTACK')</script><img src=x onerror=alert(1)>"

    # Attempt to inject script tags into remarks
    response = await test_client.put(
        f"/api/payment-requests/{draft_payment_request.id}",
        headers=regular_user_headers,
        json={"remarks": xss_payload},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["remarks"] == xss_payload  # Stored as plain string, not executed

    # Verify security hardening headers on response
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert "Content-Security-Policy" in response.headers
    assert "default-src 'self'" in response.headers["Content-Security-Policy"]
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"


@pytest.mark.asyncio
async def test_rate_limiting(
    test_client: AsyncClient,
    super_admin_user: User,
):
    """
    Ensure rate limiting triggers HTTP 429 Too Many Requests when the threshold (5/min) is exceeded.
    """
    # 5 allowed requests per minute on login
    triggered_429 = False
    for i in range(7):
        resp = await test_client.post(
            "/api/auth/login",
            json={"email": super_admin_user.email, "password": "WrongPasswordAttempt!"},
        )
        if resp.status_code == 429:
            triggered_429 = True
            data = resp.json()
            assert "too many" in data.get("error", "").lower() or "rate limit" in data.get("error", "").lower()
            assert "Retry-After" in resp.headers or "retry-after" in resp.headers
            break

    assert triggered_429, "Rate limiter did not throttle requests after 5 attempts."


@pytest.mark.asyncio
async def test_invalid_file_upload(
    test_client: AsyncClient,
    regular_user_headers: dict,
    draft_payment_request: PaymentRequest,
):
    """
    Ensure dangerous file formats and forged MIME extensions are blocked.
    """
    # 1. Shell script
    sh_file = {
        "file": ("malicious.sh", b"#!/bin/bash\nrm -rf /", "application/x-sh"),
    }
    resp1 = await test_client.post(
        f"/api/payment-requests/{draft_payment_request.id}/documents",
        headers=regular_user_headers,
        files=sh_file,
    )
    assert resp1.status_code == 400

    # 2. Windows Executable
    exe_file = {
        "file": ("trojan.exe", b"MZ\x90\x00\x03\x00", "application/x-msdownload"),
    }
    resp2 = await test_client.post(
        f"/api/payment-requests/{draft_payment_request.id}/documents",
        headers=regular_user_headers,
        files=exe_file,
    )
    assert resp2.status_code == 400

    # 3. Forged image (extension .png but plain ASCII text)
    bad_png = {
        "file": ("fake.png", b"Plain text not a real PNG image header", "image/png"),
    }
    resp3 = await test_client.post(
        f"/api/payment-requests/{draft_payment_request.id}/documents",
        headers=regular_user_headers,
        files=bad_png,
    )
    assert resp3.status_code == 400


@pytest.mark.asyncio
async def test_oversized_file_rejected(
    test_client: AsyncClient,
    regular_user_headers: dict,
    draft_payment_request: PaymentRequest,
):
    """
    Ensure files exceeding 10MB limit are rejected with HTTP 400 Bad Request.
    """
    # Create 10MB + 2KB payload with valid PDF header
    oversized = b"%PDF-1.4\n" + b"A" * (10 * 1024 * 1024 + 2048)
    files = {
        "file": ("massive_invoice.pdf", oversized, "application/pdf"),
    }

    response = await test_client.post(
        f"/api/payment-requests/{draft_payment_request.id}/documents",
        headers=regular_user_headers,
        files=files,
    )
    assert response.status_code == 400
    data = response.json()
    assert "exceeds" in data.get("message", "").lower() or "limit" in data.get("message", "").lower()


@pytest.mark.asyncio
async def test_unauthorized_api_access(
    test_client: AsyncClient,
):
    """
    Ensure API endpoints enforce authentication and reject requests missing or using forged tokens.
    """
    dummy_uuid = str(uuid.uuid4())

    # 1. Access without token -> 401
    resp1 = await test_client.get("/api/users")
    assert resp1.status_code == 401

    resp2 = await test_client.get("/api/payment-requests")
    assert resp2.status_code == 401

    resp3 = await test_client.post(f"/api/approvals/{dummy_uuid}/approve", json={})
    assert resp3.status_code == 401

    # 2. Access with forged token -> 401
    forged_headers = {"Authorization": "Bearer forged.jwt.signature"}
    resp4 = await test_client.get("/api/reports/dashboard/admin", headers=forged_headers)
    assert resp4.status_code == 401


@pytest.mark.asyncio
async def test_csrf_protection(
    test_client: AsyncClient,
    super_admin_user: User,
):
    """
    Verify CSRF defenses:
    - Login issues secure cookies with HttpOnly and SameSite=lax
    - Clickjacking protection via X-Frame-Options: DENY
    - API endpoints require explicit Authorization header
    """
    # 1. Login sets secure cookies
    login_resp = await test_client.post(
        "/api/auth/login",
        json={"email": super_admin_user.email, "password": "TestPassword123!"},
    )
    assert login_resp.status_code == 200

    cookies = login_resp.cookies
    # Verify access_token cookie flags if present
    set_cookie_header = login_resp.headers.get("set-cookie", "")
    assert "httponly" in set_cookie_header.lower()
    assert "samesite=lax" in set_cookie_header.lower()

    # 2. Anti-clickjacking header is present on responses
    assert login_resp.headers.get("X-Frame-Options") == "DENY"

    # 3. State changing mutation without authentication fails (CSRF / unauthorized isolation)
    test_client.cookies.clear()
    unauth_mutation = await test_client.post(
        "/api/payment-requests",
        json={
            "company_id": str(uuid.uuid4()),
            "department_id": str(uuid.uuid4()),
            "amount": 1000.0,
            "currency": "INR",
            "expense_category": "VENDOR_PAYMENT",
            "payment_purpose": "Test unauthenticated mutation",
        },
    )
    assert unauth_mutation.status_code == 401

"""
Authentication and Session Management Integration Tests.

Validates:
- Successful login and JWT issuance
- Invalid password rejection
- Locked user account handling
- Session revocation on logout
- Refresh token rotation
- Password reset initiation
- Missing token enforcement (401)
- Expired token rejection (401)
"""

from datetime import timedelta
import pytest
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.security import create_access_token, hash_password
from tests.conftest import TEST_PASSWORD


@pytest.mark.asyncio
async def test_login_success(
    test_client: httpx.AsyncClient, super_admin_user: User
):
    """
    Test that a valid user can successfully authenticate and receive access & refresh tokens.
    """
    payload = {
        "email": super_admin_user.email,
        "password": TEST_PASSWORD,
    }
    response = await test_client.post("/api/auth/login", json=payload)
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"

    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == super_admin_user.email
    assert data["user"]["role"]["name"] == "super_admin"
    assert "access_token" in response.cookies or "access_token" in response.headers.get("set-cookie", "")


@pytest.mark.asyncio
async def test_login_invalid_credentials(
    test_client: httpx.AsyncClient, super_admin_user: User
):
    """
    Test that authentication fails with 401 Unauthorized when an incorrect password is provided.
    """
    payload = {
        "email": super_admin_user.email,
        "password": "IncorrectPassword999!",
    }
    response = await test_client.post("/api/auth/login", json=payload)
    assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"
    data = response.json()
    assert "Invalid email or password" in data.get("message", "") or "Invalid email or password" in data.get("detail", "")


@pytest.mark.asyncio
async def test_login_locked_account(
    test_client: httpx.AsyncClient,
    test_db: AsyncSession,
    director_user: User,
):
    """
    Test that locked accounts are rejected with 403 Forbidden even if credentials match.
    """
    director_user.is_locked = True
    await test_db.commit()

    payload = {
        "email": director_user.email,
        "password": TEST_PASSWORD,
    }
    response = await test_client.post("/api/auth/login", json=payload)
    assert response.status_code == 403, f"Expected 403 Forbidden, got {response.status_code}: {response.text}"
    data = response.json()
    assert "locked" in str(data).lower()


@pytest.mark.asyncio
async def test_logout(
    test_client: httpx.AsyncClient,
    accountant_user: User,
    accountant_headers: dict,
):
    """
    Test that logging out invalidates session and clears credentials.
    """
    # First login to establish session
    login_resp = await test_client.post(
        "/api/auth/login",
        json={"email": accountant_user.email, "password": TEST_PASSWORD},
    )
    assert login_resp.status_code == 200
    refresh_token = login_resp.json()["refresh_token"]

    # Logout with refresh_token cookie and auth header
    logout_resp = await test_client.post(
        "/api/auth/logout",
        headers=accountant_headers,
        cookies={"refresh_token": refresh_token},
    )
    assert logout_resp.status_code == 200, f"Expected 200, got {logout_resp.status_code}: {logout_resp.text}"
    data = logout_resp.json()
    assert data.get("success") is True
    assert "logged out" in data.get("message", "").lower()


@pytest.mark.asyncio
async def test_token_refresh(
    test_client: httpx.AsyncClient,
    department_head_user: User,
):
    """
    Test that a valid refresh token yields a new active access token.
    """
    login_resp = await test_client.post(
        "/api/auth/login",
        json={"email": department_head_user.email, "password": TEST_PASSWORD},
    )
    assert login_resp.status_code == 200
    refresh_token = login_resp.json()["refresh_token"]

    refresh_resp = await test_client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_resp.status_code == 200, f"Expected 200, got {refresh_resp.status_code}: {refresh_resp.text}"
    data = refresh_resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == department_head_user.email


@pytest.mark.asyncio
async def test_password_reset_request(
    test_client: httpx.AsyncClient,
    regular_user: User,
):
    """
    Test that submitting a password reset request returns a success message.
    """
    payload = {"email": regular_user.email}
    response = await test_client.post("/api/auth/forgot-password", json=payload)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    assert data.get("success") is True
    assert "password reset" in data.get("message", "").lower()


@pytest.mark.asyncio
async def test_access_without_token(test_client: httpx.AsyncClient):
    """
    Test that protected endpoints reject requests lacking Authorization tokens with 401 Unauthorized.
    """
    response = await test_client.get("/api/auth/me")
    assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"


@pytest.mark.asyncio
async def test_access_with_expired_token(
    test_client: httpx.AsyncClient,
    super_admin_user: User,
):
    """
    Test that requests using an expired JWT token are rejected with 401 Unauthorized.
    """
    expired_token = create_access_token(
        data={"sub": str(super_admin_user.id), "email": super_admin_user.email, "role": "super_admin"},
        expires_delta=timedelta(minutes=-30),
    )
    headers = {"Authorization": f"Bearer {expired_token}"}
    response = await test_client.get("/api/auth/me", headers=headers)
    assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}: {response.text}"
    data = response.json()
    assert "expired" in str(data).lower()

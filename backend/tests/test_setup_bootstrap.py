"""
Security tests for system bootstrap / setup endpoints.

Covers:
- Destructive unauthenticated endpoints (/setup/seed, /setup/clean-production) are removed
- /setup/init requires SETUP_TOKEN when configured, and is disabled in production without it
- First super admin bootstrap only uses environment-provided credentials
- Production refuses default secrets
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.config import Settings, get_settings
from app.main import bootstrap_first_superadmin
from app.models.user import User

INIT_PAYLOAD = {
    "email": "owner@example.com",
    "password": "Str0ng!Passw0rd",
    "first_name": "Owner",
    "last_name": "Admin",
}


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/api/setup/seed", "/api/setup/clean-production"])
async def test_destructive_setup_endpoints_removed(test_client: AsyncClient, path: str):
    resp = await test_client.post(path)
    assert resp.status_code in (404, 405)


@pytest.mark.asyncio
async def test_init_requires_valid_setup_token(test_client: AsyncClient, test_roles, monkeypatch):
    monkeypatch.setattr(get_settings(), "SETUP_TOKEN", "correct-setup-token")

    resp = await test_client.post("/api/setup/init", json=INIT_PAYLOAD)
    assert resp.status_code == 403

    resp = await test_client.post("/api/setup/init", json={**INIT_PAYLOAD, "setup_token": "wrong"})
    assert resp.status_code == 403

    resp = await test_client.post(
        "/api/setup/init", json={**INIT_PAYLOAD, "setup_token": "correct-setup-token"}
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_init_disabled_in_production_without_token(test_client: AsyncClient, test_roles, monkeypatch):
    monkeypatch.setattr(get_settings(), "SETUP_TOKEN", "")
    monkeypatch.setattr(get_settings(), "ENVIRONMENT", "production")

    resp = await test_client.post("/api/setup/init", json=INIT_PAYLOAD)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_bootstrap_skipped_without_env_credentials(test_db, test_roles, monkeypatch):
    import app.main as main_mod

    monkeypatch.setattr(main_mod.settings, "FIRST_SUPERADMIN_EMAIL", "")
    monkeypatch.setattr(main_mod.settings, "FIRST_SUPERADMIN_PASSWORD", "")
    await bootstrap_first_superadmin(test_db)

    count = (await test_db.execute(select(func.count(User.id)))).scalar()
    assert count == 0


@pytest.mark.asyncio
async def test_bootstrap_creates_admin_from_env(test_db, test_roles, monkeypatch):
    import app.main as main_mod

    monkeypatch.setattr(main_mod.settings, "FIRST_SUPERADMIN_EMAIL", "Boss@Example.com")
    monkeypatch.setattr(main_mod.settings, "FIRST_SUPERADMIN_PASSWORD", "Very$trongPass123")
    await bootstrap_first_superadmin(test_db)

    users = (await test_db.execute(select(User))).scalars().all()
    assert [u.email for u in users] == ["boss@example.com"]

    # Running again must not create duplicates
    await bootstrap_first_superadmin(test_db)
    count = (await test_db.execute(select(func.count(User.id)))).scalar()
    assert count == 1


def test_production_rejects_default_secrets():
    s = Settings(ENVIRONMENT="production")
    with pytest.raises(RuntimeError):
        s.validate_production_secrets()

    strong = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a" * 48,
        JWT_SECRET_KEY="b" * 48,
    )
    strong.validate_production_secrets()


def test_cors_origins_env_accepts_comma_separated_and_json(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://a.example.com, https://b.example.com")
    assert Settings().CORS_ORIGINS == ["https://a.example.com", "https://b.example.com"]

    monkeypatch.setenv("CORS_ORIGINS", '["https://c.example.com"]')
    assert Settings().CORS_ORIGINS == ["https://c.example.com"]

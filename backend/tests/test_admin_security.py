"""Admin auth hardening: env-supplied password, constant-time check, rate limiting, revocation on password change."""
import secrets
from datetime import datetime, timezone, timedelta

import httpx
import pytest
import pytest_asyncio

import server
from database import db
from routes import admin as admin_routes

PW = secrets.token_urlsafe(24)  # random per run; never a real credential
PROTECTED = [("get", "/api/admin/users"), ("get", "/api/admin/stats"), ("get", "/api/admin/feedback"),
             ("get", "/api/admin/deletion-refunds"), ("get", "/api/admin/deletion-refunds/last-check"),
             ("post", "/api/admin/deletion-refunds/check-pending")]
pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest.fixture(autouse=True)
def admin_env(monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", PW)


@pytest_asyncio.fixture(loop_scope="session", autouse=True)
async def clean():
    await db.admin_login_failures.delete_many({})
    yield
    await db.admin_login_failures.delete_many({})


@pytest_asyncio.fixture(loop_scope="session")
async def client():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://test") as c:
        yield c


async def login(client, pw, ip="203.0.113.10"):
    return await client.post("/api/admin/login", json={"password": pw}, headers={"X-Forwarded-For": ip})


async def test_password_not_hardcoded_and_constant_time():
    src = open(admin_routes.__file__).read()
    assert "hmac.compare_digest(body.password.encode(), password.encode())" in src
    assert "request.password == " not in src


async def test_legit_login_reaches_all_admin_features(client):
    r = await login(client, PW)
    assert r.status_code == 200
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    for method, url in PROTECTED:
        assert (await getattr(client, method)(url, headers=h)).status_code == 200, url
    assert (await client.post("/api/admin/verify", headers=h)).json() == {"valid": True}
    session = await db.admin_sessions.find_one({"token": r.json()["token"]})
    assert PW not in str(session)  # only a salted fingerprint is stored


async def test_unauthorized_rejected(client):
    for method, url in PROTECTED:
        assert (await getattr(client, method)(url)).status_code == 401
        assert (await getattr(client, method)(url, headers={"Authorization": "Bearer forged"})).status_code == 401
    assert (await login(client, "wrong-password")).status_code == 401


async def test_rate_limit_per_ip_then_other_ip_ok(client):
    ip = "198.51.100.7"
    for _ in range(admin_routes.MAX_FAILS_PER_IP):
        assert (await login(client, "nope", ip)).status_code == 401
    locked = await login(client, PW, ip)  # even the right password is refused while locked
    assert locked.status_code == 429 and "Retry-After" in locked.headers
    assert (await login(client, PW, "198.51.100.8")).status_code == 200


async def test_global_rate_limit(client):
    now = datetime.now(timezone.utc)
    await db.admin_login_failures.insert_many([{"ip": f"10.0.0.{i}", "at": now} for i in range(admin_routes.MAX_FAILS_GLOBAL)])
    assert (await login(client, PW, "192.0.2.50")).status_code == 429


async def test_lock_expires_after_window(client):
    old = datetime.now(timezone.utc) - admin_routes.LOGIN_WINDOW - timedelta(minutes=1)
    await db.admin_login_failures.insert_many([{"ip": "198.51.100.9", "at": old} for _ in range(10)])
    assert (await login(client, PW, "198.51.100.9")).status_code == 200


async def test_password_change_revokes_existing_sessions(client, monkeypatch):
    token = (await login(client, PW)).json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    assert (await client.get("/api/admin/users", headers=h)).status_code == 200
    new_pw = secrets.token_urlsafe(24)
    monkeypatch.setenv("ADMIN_PASSWORD", new_pw)
    assert (await client.get("/api/admin/users", headers=h)).status_code == 401
    assert await db.admin_sessions.find_one({"token": token}) is None
    assert (await login(client, PW)).status_code == 401  # old password invalid
    r = await login(client, new_pw)
    assert r.status_code == 200
    assert (await client.get("/api/admin/users", headers={"Authorization": f"Bearer {r.json()['token']}"})).status_code == 200


async def test_legacy_sessions_without_fingerprint_rejected(client):
    token = secrets.token_urlsafe(16)
    await db.admin_sessions.insert_one({"token": token, "expires_at": (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat()})
    assert (await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})).status_code == 401
    assert await db.admin_sessions.find_one({"token": token}) is None


async def test_new_login_and_logout_invalidate_previous(client):
    t1 = (await login(client, PW)).json()["token"]
    t2 = (await login(client, PW)).json()["token"]
    assert (await client.get("/api/admin/users", headers={"Authorization": f"Bearer {t1}"})).status_code == 401
    h2 = {"Authorization": f"Bearer {t2}"}
    await client.post("/api/admin/logout", headers=h2)
    assert (await client.get("/api/admin/users", headers=h2)).status_code == 401


async def test_missing_admin_password_disables_login(client, monkeypatch):
    monkeypatch.delenv("ADMIN_PASSWORD")
    assert (await login(client, "anything")).status_code == 500

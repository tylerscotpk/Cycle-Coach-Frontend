"""Regression tests after refactor of server.py -> routes/{admin,ai,contact}.py"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://partner-guide-4.preview.emergentagent.com').rstrip('/')
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]  # supplied securely via env, never hardcoded


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(client):
    r = client.post(f"{BASE_URL}/api/admin/login", json={"password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("success") is True
    assert data.get("token")
    return data["token"]


# ── Auth (user) ─────────────────────────────────────────────────────
def test_user_login(client):
    r = client.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_phone": "testuser@test.com", "password": "Test1234"
    }, timeout=15)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data or "token" in data or "user" in data


# ── Admin (routes/admin.py) ─────────────────────────────────────────
def test_admin_login_wrong_password(client):
    r = client.post(f"{BASE_URL}/api/admin/login", json={"password": "wrong"}, timeout=10)
    assert r.status_code == 401


def test_admin_stats(client, admin_token):
    r = client.get(f"{BASE_URL}/api/admin/stats",
                   headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert "users" in data
    users = data["users"]
    for k in ["total", "trial", "basic", "advanced", "lifetime"]:
        assert k in users, f"missing key {k}"
        assert isinstance(users[k], int)


def test_admin_users_list(client, admin_token):
    r = client.get(f"{BASE_URL}/api/admin/users",
                   headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "users" in data
    assert "count" in data
    assert isinstance(data["users"], list)


def test_admin_verify_token(client, admin_token):
    r = client.post(f"{BASE_URL}/api/admin/verify",
                    headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    assert r.status_code == 200
    assert r.json().get("valid") is True


def test_admin_stats_unauthorized(client):
    r = client.get(f"{BASE_URL}/api/admin/stats", timeout=10)
    assert r.status_code == 401


# ── AI (routes/ai.py) ───────────────────────────────────────────────
def test_ai_anonymous_chat(client):
    r = client.post(f"{BASE_URL}/api/chat/anonymous", json={
        "message": "My partner is on day 3 of her cycle. Any tips?",
        "cycle_day": 3,
        "phase": "menstrual"
    }, timeout=60)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert "response" in data
    assert "session_id" in data
    assert isinstance(data["response"], str)
    assert len(data["response"]) > 10


def test_ai_personalized_tips(client):
    r = client.post(f"{BASE_URL}/api/tips/personalized", json={
        "phase": "follicular",
        "cycle_day": 8,
        "partner_name": "Alex"
    }, timeout=60)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert "tips" in data
    assert isinstance(data["tips"], list)
    assert len(data["tips"]) >= 1


# ── Health ──────────────────────────────────────────────────────────
def test_health(client):
    r = client.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code in (200, 404)  # depending on impl

"""Backend tests for Admin Dashboard endpoints: /api/admin/stats, /api/admin/users, /api/admin/grant-lifetime"""
import os
import pytest
import requests

from dotenv import dotenv_values

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL"))
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PASSWORD = "cyclecoach2024"


@pytest.fixture(scope="module")
def client():
    """Admin-authenticated session (admin endpoints now require a bearer admin token)."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/admin/login", json={"password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:300]}")
    token = r.json().get("token")
    if not token:
        pytest.fail("admin login returned no token")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---------- /admin/stats ----------
class TestAdminStats:
    def test_stats_shape(self, client):
        r = client.get(f"{API}/admin/stats")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "users" in data
        u = data["users"]
        for key in ["total", "trial", "basic", "advanced", "no_plan", "cancelled"]:
            assert key in u, f"missing key: {key}"
            assert isinstance(u[key], int), f"{key} not int: {u[key]}"
        # sanity: total >= sum of exclusive buckets is not guaranteed (overlaps possible)
        assert u["total"] >= 0


# ---------- /admin/users ----------
class TestAdminUsers:
    def test_all_users(self, client):
        r = client.get(f"{API}/admin/users")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "users" in d and "count" in d
        assert isinstance(d["users"], list)
        assert d["count"] == len(d["users"])
        # no mongodb _id leakage
        if d["users"]:
            assert "_id" not in d["users"][0]
            assert "password_hash" not in d["users"][0]

    def test_filter_trial(self, client):
        r = client.get(f"{API}/admin/users", params={"plan_type": "trial"})
        assert r.status_code == 200
        for u in r.json()["users"]:
            assert u.get("plan_type") == "trial"

    def test_filter_basic(self, client):
        r = client.get(f"{API}/admin/users", params={"subscription_tier": "basic"})
        assert r.status_code == 200
        for u in r.json()["users"]:
            assert u.get("subscription_tier") == "basic"

    def test_filter_advanced(self, client):
        r = client.get(f"{API}/admin/users", params={"subscription_tier": "advanced"})
        assert r.status_code == 200
        for u in r.json()["users"]:
            assert u.get("subscription_tier") == "advanced"

    def test_filter_cancelled(self, client):
        r = client.get(f"{API}/admin/users", params={"cancelled": "true"})
        assert r.status_code == 200
        for u in r.json()["users"]:
            assert u.get("subscription_status") in ("cancelled", "cancelling")

    def test_filter_no_plan(self, client):
        r = client.get(f"{API}/admin/users", params={"no_plan": "true"})
        assert r.status_code == 200
        for u in r.json()["users"]:
            assert u.get("subscription_status") in (None, "", "null") or "subscription_status" not in u


# ---------- /admin/grant-lifetime ----------
class TestGrantLifetime:
    def test_grant_lifetime_not_found(self, client):
        r = client.post(f"{API}/admin/grant-lifetime/nonexistent_test_email_xyz@nope.test")
        assert r.status_code == 404

    def test_grant_lifetime_success_then_verify(self, client):
        # Use trial user for this test
        email = "trialtest@test.com"
        r = client.post(f"{API}/admin/grant-lifetime/{email}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") == "granted"
        assert d.get("email") == email
        assert "stripe_cancelled" in d

        # Verify via /admin/users
        r2 = client.get(f"{API}/admin/users")
        assert r2.status_code == 200
        users = r2.json()["users"]
        u = next((x for x in users if x.get("email") == email), None)
        assert u is not None, "user not found after grant"
        assert u.get("subscription_tier") == "grandfathered"
        assert u.get("plan_type") == "grandfathered"
        assert u.get("subscription_status") == "active"


# ---------- PWA icons ----------
class TestPWAIcons:
    def test_icon_192(self):
        r = requests.get(f"{BASE_URL}/icon-192.png", timeout=15)
        assert r.status_code == 200, f"got {r.status_code}"
        assert r.headers.get("content-type", "").startswith("image/"), r.headers.get("content-type")
        assert len(r.content) > 500

    def test_icon_512(self):
        r = requests.get(f"{BASE_URL}/icon-512.png", timeout=15)
        assert r.status_code == 200, f"got {r.status_code}"
        assert r.headers.get("content-type", "").startswith("image/"), r.headers.get("content-type")
        assert len(r.content) > 500

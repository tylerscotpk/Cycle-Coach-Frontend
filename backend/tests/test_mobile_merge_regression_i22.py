"""
Iteration 22 - Full regression after merging mobile assets (android-current-backup -> Real).
Covers: auth login/check (grandfathered), admin stats/grant-lifetime auth guards,
stripe create-checkout & upgrade, email-verification idempotency guard, config files.
"""
import json
import os
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

TEST_EMAIL = "testuser@test.com"
TEST_PASSWORD = "Test1234"
ADMIN_PASSWORD = "cyclecoach2024"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_token(client):
    r = client.post(f"{BASE_URL}/api/auth/login",
                    json={"email_or_phone": TEST_EMAIL, "password": TEST_PASSWORD})
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:400]}")
    tok = r.json().get("token") or r.json().get("session_token")
    if not tok:
        pytest.fail(f"no token in login response: {r.text[:400]}")
    return tok


@pytest.fixture(scope="module")
def admin_token(client):
    r = client.post(f"{BASE_URL}/api/admin/login", json={"password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:400]}")
    tok = r.json().get("token")
    assert tok, r.text[:400]
    return tok


# ---------------- health ----------------
def test_health(client):
    r = client.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200, r.text[:300]


# ---------------- auth ----------------
class TestAuth:
    def test_login_grandfathered(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login",
                        json={"email_or_phone": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d.get("success") is True, d
        u = d.get("user", {})
        assert u.get("has_subscription") is True, d
        assert u.get("plan_type") == "grandfathered", d
        assert u.get("subscription_tier") == "grandfathered", d
        assert u.get("email") == TEST_EMAIL, d
        assert d.get("session_token"), d

    def test_login_bad_password(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login",
                        json={"email_or_phone": TEST_EMAIL, "password": "WrongPass999"})
        assert r.status_code in (400, 401), r.text[:300]

    def test_auth_check_with_token(self, client, user_token):
        r = client.get(f"{BASE_URL}/api/auth/check",
                       headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d.get("authenticated") is True, d
        assert d.get("has_subscription") is True, d
        assert d.get("user", {}).get("plan_type") == "grandfathered", d

    def test_auth_check_without_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/check")
        assert r.status_code in (200, 401), r.text[:300]
        if r.status_code == 200:
            assert r.json().get("authenticated") is False, r.json()

    def test_auth_check_invalid_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/check",
                         headers={"Authorization": "Bearer not-a-real-token"})
        assert r.status_code in (200, 401)
        if r.status_code == 200:
            assert r.json().get("authenticated") is False

    def test_account_subscription(self, client, user_token):
        r = client.get(f"{BASE_URL}/api/account/subscription",
                       headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert "_id" not in d, "mongo _id leaked"
        assert d.get("plan_type") == "grandfathered", d
        assert d.get("subscription_status") == "active", d


# ---------------- email verification ----------------
class TestVerifyEmail:
    def test_invalid_token_rejected(self, client):
        r = client.get(f"{BASE_URL}/api/auth/verify-email", params={"token": "bogus-token-xyz"})
        assert r.status_code in (400, 404), r.text[:300]

    def test_missing_token(self, client):
        r = client.get(f"{BASE_URL}/api/auth/verify-email")
        assert r.status_code in (400, 422), r.text[:300]

    def test_resend_for_verified_user(self, client):
        r = client.post(f"{BASE_URL}/api/auth/resend-verification", json={"email": TEST_EMAIL})
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d.get("already_verified") is True or d.get("success") is True, d


# ---------------- admin ----------------
class TestAdmin:
    def test_stats_requires_auth(self, client):
        r = client.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:300]}"

    def test_stats_with_token(self, client, admin_token):
        r = client.get(f"{BASE_URL}/api/admin/stats",
                       headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert isinstance(d, dict) and len(d) > 0, d
        assert "_id" not in d

    def test_users_requires_auth(self, client):
        r = client.get(f"{BASE_URL}/api/admin/users")
        assert r.status_code == 401, r.text[:300]

    def test_users_with_token(self, client, admin_token):
        r = client.get(f"{BASE_URL}/api/admin/users",
                       headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        users = d if isinstance(d, list) else d.get("users", [])
        assert isinstance(users, list) and len(users) > 0
        assert all("_id" not in u for u in users), "mongo _id leaked in admin users"

    def test_grant_lifetime_requires_auth(self, client):
        r = client.post(f"{BASE_URL}/api/admin/grant-lifetime/nobody@example.com")
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:300]}"

    def test_grant_lifetime_bad_admin_token(self, client):
        r = client.post(f"{BASE_URL}/api/admin/grant-lifetime/nobody@example.com",
                        headers={"Authorization": "Bearer fake-admin"})
        assert r.status_code == 401, r.text[:300]

    def test_archive_user_requires_auth(self, client):
        r = client.post(f"{BASE_URL}/api/admin/archive-user/nobody@example.com")
        assert r.status_code == 401, r.text[:300]

    def test_admin_login_wrong_password(self, client):
        r = client.post(f"{BASE_URL}/api/admin/login", json={"password": "wrong-pass"})
        assert r.status_code in (401, 403), r.text[:300]

    def test_admin_verify(self, client, admin_token):
        r = client.post(f"{BASE_URL}/api/admin/verify",
                        headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text[:300]


# ---------------- stripe / subscription ----------------
class TestStripe:
    def test_create_checkout_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/subscription/create-checkout",
                          json={"plan": "advanced",
                                "success_url": f"{BASE_URL}/success",
                                "cancel_url": f"{BASE_URL}/cancel"})
        assert r.status_code in (401, 403, 422), r.text[:300]

    def test_invalid_plan_rejected(self, client, user_token):
        r = client.post(f"{BASE_URL}/api/subscription/create-checkout",
                        headers={"Authorization": f"Bearer {user_token}"},
                        json={"plan": "bogus",
                              "success_url": f"{BASE_URL}/s", "cancel_url": f"{BASE_URL}/c"})
        assert r.status_code == 400, r.text[:300]

    def test_create_checkout(self, client, user_token):
        r = client.post(f"{BASE_URL}/api/subscription/create-checkout",
                        headers={"Authorization": f"Bearer {user_token}"},
                        json={"plan": "advanced",
                              "success_url": f"{BASE_URL}/success",
                              "cancel_url": f"{BASE_URL}/cancel"})
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        url = d.get("checkout_url")
        assert url and url.startswith("https://"), d
        assert d.get("session_id"), d

    def test_upgrade_returns_use_checkout(self, client, user_token):
        r = client.post(f"{BASE_URL}/api/subscription/upgrade",
                        headers={"Authorization": f"Bearer {user_token}"},
                        json={})
        # grandfathered user has no stripe_subscription_id -> 400 + use_checkout flag
        assert r.status_code == 400, r.text[:500]
        d = r.json()
        assert d.get("use_checkout") is True, d
        assert d.get("success") is False, d

    def test_subscription_sync(self, client, user_token):
        r = client.post(f"{BASE_URL}/api/subscription/sync",
                        headers={"Authorization": f"Bearer {user_token}"}, json={})
        assert r.status_code == 200, r.text[:500]


# ---------------- mobile config files (merge items) ----------------
class TestMobileConfig:
    def test_capacitor_server_url(self):
        cfg = json.loads(Path("/app/frontend/capacitor.config.json").read_text())
        assert cfg["server"]["url"] == "https://cyclecoach.net", cfg
        assert cfg["appId"] == "net.cyclecoach.app"

    def test_android_cookiemanager(self):
        p = Path("/app/frontend/android/app/src/main/java/net/cyclecoach/app/MainActivity.java")
        assert p.exists()
        src = p.read_text()
        assert "import android.webkit.CookieManager;" in src
        assert "setAcceptThirdPartyCookies" in src

    def test_android_permissions(self):
        m = Path("/app/frontend/android/app/src/main/AndroidManifest.xml").read_text()
        for perm in ["INTERNET", "ACCESS_NETWORK_STATE", "POST_NOTIFICATIONS",
                     "WAKE_LOCK", "com.android.vending.BILLING"]:
            assert perm in m, f"missing permission {perm}"

    def test_android_icons(self):
        res = Path("/app/frontend/android/app/src/main/res")
        for d in ["mipmap-mdpi", "mipmap-hdpi", "mipmap-xhdpi", "mipmap-xxhdpi", "mipmap-xxxhdpi"]:
            assert (res / d / "ic_launcher.png").exists() or (res / d / "ic_launcher.webp").exists(), d

    def test_ios_url_scheme_and_bundle(self):
        plist = Path("/app/frontend/ios/App/App/Info.plist").read_text()
        assert "<string>cyclecoach</string>" in plist
        assert "net.cyclecoach.app" in plist
        pbx = Path("/app/frontend/ios/App/App.xcodeproj/project.pbxproj").read_text()
        assert "PRODUCT_BUNDLE_IDENTIFIER = net.cyclecoach.app;" in pbx

"""Backend tests for subscription flow bug fixes (iteration 12).
Covers:
- Bug #1: /api/subscription/upgrade returns use_checkout:true when no stripe_subscription_id
- Bug #4: /api/account/cancel-subscription handles missing subscription (400) — full
          incomplete_expired ghost path requires a real Stripe sub, so covered as code review
- Bug #5: /api/account/subscription returns plan_type/subscription_tier for badge fallback
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://partner-guide-4.preview.emergentagent.com").rstrip("/")

TEST_EMAIL = "testuser@test.com"
TEST_PASSWORD = "Test1234"


@pytest.fixture(scope="module")
def session_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email_or_phone": TEST_EMAIL, "password": TEST_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("session_token")
    assert tok, "no session_token in login response"
    return tok


@pytest.fixture(scope="module")
def auth_headers(session_token):
    return {"Authorization": f"Bearer {session_token}"}


def test_login_returns_user_and_tier(session_token):
    """Sanity: login works and gives us user info"""
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email_or_phone": TEST_EMAIL, "password": TEST_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["user"]["email"] == TEST_EMAIL
    # grandfathered user
    assert data["user"]["has_subscription"] is True


def test_account_subscription_returns_tier_fields(auth_headers):
    """Bug #5: /api/account/subscription returns fields required for tier badge fallback"""
    r = requests.get(f"{BASE_URL}/api/account/subscription", headers=auth_headers, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    # Fields that AccountSettings.jsx reads for the badge
    assert "subscription_tier" in data
    assert "plan_type" in data
    assert "subscription_status" in data
    assert "stripe_subscription_id" in data
    # testuser is grandfathered
    tier = data.get("subscription_tier") or data.get("plan_type")
    assert tier == "grandfathered", f"expected grandfathered, got tier={tier}"


def test_upgrade_no_subscription_returns_use_checkout(auth_headers):
    """Bug #1: upgrade endpoint returns use_checkout:true for user with no stripe_subscription_id"""
    r = requests.post(f"{BASE_URL}/api/subscription/upgrade", headers=auth_headers, timeout=15)
    # Should be 400 with use_checkout:true payload (JSONResponse, not HTTPException)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
    data = r.json()
    assert data.get("use_checkout") is True, f"missing use_checkout:true in {data}"
    assert data.get("success") is False


def test_cancel_no_subscription_returns_400(auth_headers):
    """Bug #4 partial: cancel endpoint with no stripe_subscription_id returns 400 (not 500)"""
    r = requests.post(f"{BASE_URL}/api/account/cancel-subscription", headers=auth_headers, timeout=15)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
    data = r.json()
    # FastAPI HTTPException returns {"detail": "..."}
    assert "detail" in data or "message" in data


def test_auth_check_grandfathered(auth_headers):
    """auth/check returns has_subscription:true for grandfathered user"""
    r = requests.get(f"{BASE_URL}/api/auth/check", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data.get("authenticated") is True
    assert data.get("has_subscription") is True


def test_unauth_upgrade_returns_401():
    r = requests.post(f"{BASE_URL}/api/subscription/upgrade", timeout=10)
    assert r.status_code == 401


def test_unauth_cancel_returns_401():
    r = requests.post(f"{BASE_URL}/api/account/cancel-subscription", timeout=10)
    assert r.status_code == 401

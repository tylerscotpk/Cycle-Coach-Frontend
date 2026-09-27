"""Iteration 30: Backend payment fixes tests
- Downgrade sets flag, not tier
- Price IDs from env
- Legacy /api/cancel-subscription removed
- Webhook signature enforced
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://partner-guide-4.preview.emergentagent.com').rstrip('/')
TEST_EMAIL = "testuser@test.com"
TEST_PASSWORD = "Test1234"


@pytest.fixture(scope="module")
def session_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email_or_phone": TEST_EMAIL, "password": TEST_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "session_token" in data
    return data["session_token"]


@pytest.fixture
def auth_headers(session_token):
    return {"Authorization": f"Bearer {session_token}"}


# --- Health check
def test_health():
    r = requests.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200


# --- Auth login
def test_login_returns_session_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email_or_phone": TEST_EMAIL, "password": TEST_PASSWORD})
    assert r.status_code == 200
    data = r.json()
    assert data.get("session_token")
    assert data.get("user", {}).get("email") == TEST_EMAIL


# --- /api/auth/check contains new downgrade fields
def test_auth_check_returns_downgrade_fields(auth_headers):
    r = requests.get(f"{BASE_URL}/api/auth/check", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body.get("authenticated") is True
    user = body.get("user", {})
    assert "downgrade_at_period_end" in user, f"missing field: {user}"
    assert "downgrade_to" in user
    assert "downgrade_date" in user
    assert isinstance(user["downgrade_at_period_end"], bool)
    assert user["downgrade_to"] is None
    assert user["downgrade_date"] is None


# --- /api/account/subscription contains downgrade fields
def test_account_subscription_returns_downgrade_fields(auth_headers):
    r = requests.get(f"{BASE_URL}/api/account/subscription", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "downgrade_at_period_end" in body
    assert "downgrade_to" in body
    assert "downgrade_date" in body
    assert isinstance(body["downgrade_at_period_end"], bool)


# --- Legacy /api/cancel-subscription removed
def test_legacy_cancel_subscription_removed():
    r = requests.post(f"{BASE_URL}/api/cancel-subscription")
    assert r.status_code in (404, 405), f"Expected 404/405 got {r.status_code}"


# --- Webhook: no Stripe-Signature -> 400
def test_webhook_missing_signature():
    r = requests.post(f"{BASE_URL}/api/webhook/stripe",
                      data=b'{"type":"test"}',
                      headers={"Content-Type": "application/json"})
    assert r.status_code == 400
    body_text = r.text.lower()
    assert "missing" in body_text and "stripe-signature" in body_text


# --- Webhook: invalid signature -> 400
def test_webhook_invalid_signature():
    r = requests.post(f"{BASE_URL}/api/webhook/stripe",
                      data=b'{"type":"test"}',
                      headers={"Content-Type": "application/json",
                               "Stripe-Signature": "t=123,v1=bogus"})
    assert r.status_code == 400
    assert "invalid signature" in r.text.lower()


# --- Create checkout requires auth
def test_create_checkout_requires_auth():
    r = requests.post(f"{BASE_URL}/api/subscription/create-checkout",
                      json={"plan": "basic", "success_url": "https://x.com/s",
                            "cancel_url": "https://x.com/c"})
    assert r.status_code == 401


# --- Create checkout plan=basic uses env price
def test_create_checkout_basic(auth_headers):
    r = requests.post(f"{BASE_URL}/api/subscription/create-checkout",
                      headers=auth_headers,
                      json={"plan": "basic",
                            "success_url": "https://x.com/s",
                            "cancel_url": "https://x.com/c"})
    # If price env vars invalid, would be 400 stripe error. Otherwise 200
    assert r.status_code == 200, f"basic checkout failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("checkout_url", "").startswith("https://")


def test_create_checkout_advanced(auth_headers):
    r = requests.post(f"{BASE_URL}/api/subscription/create-checkout",
                      headers=auth_headers,
                      json={"plan": "advanced",
                            "success_url": "https://x.com/s",
                            "cancel_url": "https://x.com/c"})
    assert r.status_code == 200, f"advanced checkout failed: {r.status_code} {r.text}"
    assert r.json().get("checkout_url", "").startswith("https://")


def test_create_checkout_invalid_plan(auth_headers):
    r = requests.post(f"{BASE_URL}/api/subscription/create-checkout",
                      headers=auth_headers,
                      json={"plan": "nonsense",
                            "success_url": "https://x.com/s",
                            "cancel_url": "https://x.com/c"})
    assert r.status_code == 400


# --- Sync requires auth
def test_sync_requires_auth():
    r = requests.post(f"{BASE_URL}/api/subscription/sync")
    assert r.status_code == 401


# --- Downgrade endpoint exists, requires auth
def test_downgrade_requires_auth():
    r = requests.post(f"{BASE_URL}/api/subscription/downgrade")
    assert r.status_code == 401

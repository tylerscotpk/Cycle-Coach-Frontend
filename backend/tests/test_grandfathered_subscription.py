"""Tests for grandfathered/lifetime user subscription recognition (Bugs #1, #7)
and the endpoints backing Bug #4/#5 code paths."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://partner-guide-4.preview.emergentagent.com').rstrip('/')

TEST_USER_EMAIL = "testuser@test.com"
TEST_USER_PASSWORD = "Test1234"


@pytest.fixture(scope="module")
def session():
    return requests.Session()


@pytest.fixture(scope="module")
def login_data(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_phone": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD,
    })
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()


class TestGrandfatheredLogin:
    """Bug #1/#7 — login returns has_subscription:true for grandfathered users."""

    def test_login_success(self, login_data):
        assert login_data.get("success") is True
        assert "user" in login_data
        assert "session_token" in login_data

    def test_login_has_subscription_true(self, login_data):
        assert login_data["user"]["has_subscription"] is True, \
            f"grandfathered user must have has_subscription=true, got user={login_data['user']}"

    def test_login_subscription_tier_grandfathered(self, login_data):
        user = login_data["user"]
        assert user.get("subscription_tier") == "grandfathered", \
            f"expected subscription_tier=grandfathered, got {user.get('subscription_tier')}"

    def test_login_plan_type(self, login_data):
        # plan_type should be grandfathered (per admin grant-lifetime)
        plan_type = login_data["user"].get("plan_type")
        assert plan_type in ("grandfathered", "lifetime"), \
            f"expected plan_type grandfathered/lifetime, got {plan_type}"


class TestGrandfatheredAuthCheck:
    """Bug #1/#7 — /api/auth/check returns has_subscription:true for grandfathered."""

    def test_auth_check_authenticated(self, session, login_data):
        token = login_data["session_token"]
        r = session.get(f"{BASE_URL}/api/auth/check",
                        headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("authenticated") is True

    def test_auth_check_has_subscription_true(self, session, login_data):
        token = login_data["session_token"]
        r = session.get(f"{BASE_URL}/api/auth/check",
                        headers={"Authorization": f"Bearer {token}"})
        data = r.json()
        assert data.get("has_subscription") is True, \
            f"grandfathered user auth/check must return has_subscription=true, got {data}"
        assert data["user"]["subscription_tier"] == "grandfathered"


class TestAccountSubscriptionEndpoint:
    """/api/account/subscription returns grandfathered tier."""

    def test_account_subscription(self, session, login_data):
        token = login_data["session_token"]
        r = session.get(f"{BASE_URL}/api/account/subscription",
                        headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("subscription_tier") == "grandfathered"
        assert data.get("email") == TEST_USER_EMAIL


class TestUpgradeEndpointForGrandfathered:
    """Bug #2 — upgrade shouldn't be needed for grandfathered users.
    Endpoint should return 400 (no stripe sub) since grant-lifetime cancels the Stripe sub."""

    def test_upgrade_rejects_grandfathered(self, session, login_data):
        token = login_data["session_token"]
        r = session.post(f"{BASE_URL}/api/subscription/upgrade",
                         headers={"Authorization": f"Bearer {token}"})
        # Should be 400 — no active stripe sub (was cancelled on grant-lifetime)
        # If it returns 200, that means grandfathered user got charged, which is a bug
        assert r.status_code in (400,), \
            f"expected 400 for grandfathered user (no stripe sub), got {r.status_code}: {r.text}"


class TestUnauthenticated:
    def test_auth_check_no_token(self, session):
        s = requests.Session()  # fresh, no cookies
        r = s.get(f"{BASE_URL}/api/auth/check")
        assert r.status_code == 200
        data = r.json()
        assert data.get("authenticated") is False
        assert data.get("has_subscription") is False

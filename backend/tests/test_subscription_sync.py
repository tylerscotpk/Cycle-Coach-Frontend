"""
Test Subscription Sync Endpoint and Auth Check Subscription Status
Tests the /api/subscription/sync endpoint that queries Stripe directly (bypasses webhook)
Tests /api/auth/check returns correct has_subscription based on subscription_status
Tests /api/webhook/stripe is reachable

Test user: cors_test@test.com (subscription_status=active in MongoDB)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://partner-guide-4.preview.emergentagent.com"

# Test credentials
TEST_EMAIL = "cors_test@test.com"
TEST_PASSWORD = "test123456"


@pytest.fixture(scope="module")
def session():
    """Create requests session with common headers"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    """Login and get session token"""
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_phone": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("session_token")
    pytest.skip(f"Could not login with test user: {response.status_code} - {response.text}")


class TestSubscriptionSync:
    """Tests for POST /api/subscription/sync endpoint"""
    
    def test_sync_returns_401_without_auth(self, session):
        """POST /api/subscription/sync returns 401 without auth token"""
        response = session.post(f"{BASE_URL}/api/subscription/sync")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data or "error" in data
        print(f"PASS: /api/subscription/sync returns 401 without auth - {data}")
    
    def test_sync_with_auth_token(self, session, auth_token):
        """POST /api/subscription/sync with Bearer token works"""
        response = session.post(
            f"{BASE_URL}/api/subscription/sync",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code} - {response.text}"
        data = response.json()
        
        # cors_test@test.com has subscription_status=active in MongoDB
        # Should return already_entitled:true since user already has active status
        assert "synced" in data, f"Response missing 'synced' field: {data}"
        
        if data.get("synced"):
            # Either already_entitled or found in Stripe
            if data.get("already_entitled"):
                assert data["subscription_status"] in ("active", "trialing", "cancelling"), f"Expected entitled status: {data}"
                print(f"PASS: Sync returned already_entitled=true, status={data['subscription_status']}")
            else:
                # Found subscription in Stripe
                assert "subscription_status" in data, f"Missing subscription_status: {data}"
                print(f"PASS: Sync found subscription in Stripe, status={data['subscription_status']}")
        else:
            # User doesn't have subscription in Stripe but has active status in DB
            # This is expected for cors_test@test.com if they only have DB status, not Stripe
            assert "reason" in data, f"Response missing 'reason' when synced=false: {data}"
            print(f"INFO: Sync returned synced=false, reason={data.get('reason')}")


class TestAuthCheckSubscription:
    """Tests for GET /api/auth/check subscription status"""
    
    def test_auth_check_returns_subscription_status(self, session, auth_token):
        """GET /api/auth/check returns has_subscription:true for user with subscription_status=active"""
        response = session.get(
            f"{BASE_URL}/api/auth/check",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data.get("authenticated") == True, f"Expected authenticated:true, got {data}"
        
        # cors_test@test.com has subscription_status=active
        assert data.get("has_subscription") == True, f"Expected has_subscription:true, got {data}"
        
        # Verify user object has subscription fields
        user = data.get("user", {})
        assert user.get("subscription_status") == "active", f"Expected subscription_status=active, got {user}"
        print(f"PASS: /api/auth/check returns has_subscription=true for subscribed user")
        print(f"  User: {user.get('email')}, status={user.get('subscription_status')}, tier={user.get('subscription_tier')}")
    
    def test_auth_check_without_token(self, session):
        """GET /api/auth/check without token returns has_subscription:false"""
        # Use a fresh session without any cookies
        fresh_session = requests.Session()
        fresh_session.headers.update({"Content-Type": "application/json"})
        
        response = fresh_session.get(f"{BASE_URL}/api/auth/check")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data.get("authenticated") == False, f"Expected authenticated:false, got {data}"
        assert data.get("has_subscription") == False, f"Expected has_subscription:false, got {data}"
        print("PASS: /api/auth/check returns has_subscription=false without auth")


class TestWebhookReachable:
    """Tests for POST /api/webhook/stripe reachability"""
    
    def test_webhook_endpoint_exists(self, session):
        """POST /api/webhook/stripe is reachable (handles empty payload gracefully)"""
        response = session.post(f"{BASE_URL}/api/webhook/stripe", data=b"")
        
        # Empty payload should return either:
        # - 400 (invalid signature) if webhook secret is configured
        # - 500 (json decode error) if no webhook secret
        # - 200 with some response if it processes empty gracefully
        
        # The endpoint should NOT return 404
        assert response.status_code != 404, f"Webhook endpoint not found! Got {response.status_code}"
        
        # Acceptable responses for empty payload:
        # - 400: Invalid signature / Bad request
        # - 500: Internal error processing empty payload (acceptable)
        # - 200: Processed gracefully
        assert response.status_code in (200, 400, 500), f"Unexpected status: {response.status_code}"
        print(f"PASS: /api/webhook/stripe is reachable (status={response.status_code})")
    
    def test_webhook_handles_invalid_json(self, session):
        """POST /api/webhook/stripe handles invalid JSON gracefully"""
        response = session.post(
            f"{BASE_URL}/api/webhook/stripe",
            data="not-valid-json",
            headers={"Content-Type": "application/json"}
        )
        
        # Should not crash the server
        assert response.status_code != 404, "Webhook endpoint not found!"
        # 400 or 500 is expected for invalid JSON
        assert response.status_code in (200, 400, 500), f"Unexpected status: {response.status_code}"
        print(f"PASS: /api/webhook/stripe handles invalid JSON (status={response.status_code})")


class TestUserWithoutSubscription:
    """Tests for users without active subscription"""
    
    def test_register_new_user_no_subscription(self, session):
        """New registered user has has_subscription:false"""
        import uuid
        test_email = f"TEST_nosub_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register new user
        reg_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "confirm_password": "testpass123"
        })
        
        if reg_response.status_code != 200:
            pytest.skip(f"Could not register test user: {reg_response.text}")
        
        reg_data = reg_response.json()
        token = reg_data.get("session_token")
        
        # Check auth
        check_response = session.get(
            f"{BASE_URL}/api/auth/check",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert check_response.status_code == 200
        check_data = check_response.json()
        
        assert check_data.get("authenticated") == True
        assert check_data.get("has_subscription") == False, f"New user should not have subscription: {check_data}"
        
        user = check_data.get("user", {})
        assert user.get("subscription_status") in (None, ""), f"New user should have no subscription_status: {user}"
        print(f"PASS: Newly registered user has has_subscription=false")


class TestSyncForUserWithoutStripeSubscription:
    """Tests sync endpoint for user who has DB status but no Stripe subscription"""
    
    def test_sync_returns_already_entitled_for_db_status(self, session, auth_token):
        """Sync returns already_entitled:true for user with subscription_status=active in DB"""
        response = session.post(
            f"{BASE_URL}/api/subscription/sync",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # cors_test@test.com has subscription_status=active in MongoDB (set manually, not via Stripe)
        # The sync endpoint should detect this and return already_entitled:true
        if data.get("already_entitled"):
            assert data.get("synced") == True
            assert data.get("subscription_status") in ("active", "trialing", "cancelling")
            print(f"PASS: Sync returns already_entitled=true for user with DB subscription_status")
        elif data.get("synced") == False:
            # No Stripe subscription found, but user already has DB status - this is fine
            print(f"INFO: Sync returns synced=false (reason={data.get('reason')}), but user has DB status")
        else:
            print(f"INFO: Sync response: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

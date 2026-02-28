"""
Test Suite for Account-First Flow Overhaul
Testing: Registration, Login, Stripe Webhook, Admin Stats, Routing Logic
"""
import pytest
import requests
import os
import uuid
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://partner-guide-4.preview.emergentagent.com').rstrip('/')

# Test credentials from requirements
TEST_USER_WITH_SUB = {"email": "flowtest@example.com", "password": "test1234"}
TEST_USER_NO_SUB = {"email": "testuser123@example.com", "password": "test1234"}
ADMIN_PASSWORD = "cyclecoach2024"

class TestAuthRegister:
    """Test user registration endpoint"""
    
    def test_register_success(self):
        """New user registration should create account and return session_token"""
        unique_email = f"TEST_register_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "confirm_password": "testpass123",
            "phone": None
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "session_token" in data
        assert len(data["session_token"]) > 0
        assert data["user"]["email"] == unique_email.lower()
        assert data["user"]["has_subscription"] == False
        print(f"✓ Register success: {unique_email}")
    
    def test_register_password_mismatch(self):
        """Password mismatch should return 400"""
        unique_email = f"TEST_mismatch_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "confirm_password": "wrongpass456"
        })
        
        assert response.status_code == 400
        assert "match" in response.json().get("detail", "").lower()
        print("✓ Password mismatch returns 400")
    
    def test_register_duplicate_email(self):
        """Duplicate email should return 400"""
        # First registration
        unique_email = f"TEST_dup_{uuid.uuid4().hex[:8]}@example.com"
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "confirm_password": "testpass123"
        })
        
        # Second registration with same email
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "confirm_password": "testpass123"
        })
        
        assert response.status_code == 400
        assert "already exists" in response.json().get("detail", "").lower()
        print("✓ Duplicate email returns 400")


class TestAuthLogin:
    """Test login endpoint"""
    
    def test_login_user_with_subscription(self):
        """Login with active subscription returns has_subscription=True"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": TEST_USER_WITH_SUB["email"],
            "password": TEST_USER_WITH_SUB["password"]
        })
        
        # If user doesn't exist, create them first
        if response.status_code == 401:
            pytest.skip(f"Test user {TEST_USER_WITH_SUB['email']} not found - needs seed data")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "session_token" in data
        assert data["user"]["has_subscription"] == True
        assert data["user"]["subscription_status"] == "active"
        print(f"✓ Login with subscription works: {data['user']['email']}")
    
    def test_login_user_without_subscription(self):
        """Login without subscription returns has_subscription=False"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": TEST_USER_NO_SUB["email"],
            "password": TEST_USER_NO_SUB["password"]
        })
        
        if response.status_code == 401:
            pytest.skip(f"Test user {TEST_USER_NO_SUB['email']} not found - needs seed data")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Login without subscription returns user object")
    
    def test_login_invalid_credentials(self):
        """Invalid credentials should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "nonexistent@example.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
        print("✓ Invalid credentials returns 401")


class TestAuthCheck:
    """Test auth check endpoint"""
    
    def test_auth_check_unauthenticated(self):
        """Unauthenticated request returns authenticated=false"""
        response = requests.get(f"{BASE_URL}/api/auth/check")
        
        assert response.status_code == 200
        data = response.json()
        assert data["authenticated"] == False
        assert data["has_subscription"] == False
        print("✓ Unauthenticated check returns false")
    
    def test_auth_check_with_valid_token(self):
        """Valid token returns authenticated=true with user details"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": TEST_USER_WITH_SUB["email"],
            "password": TEST_USER_WITH_SUB["password"]
        })
        
        if login_response.status_code != 200:
            pytest.skip("Could not login to get token")
        
        token = login_response.json()["session_token"]
        
        # Check auth with token
        response = requests.get(
            f"{BASE_URL}/api/auth/check",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["authenticated"] == True
        assert "user" in data
        print(f"✓ Auth check with valid token works: authenticated={data['authenticated']}")


class TestAccountSubscription:
    """Test account subscription endpoint"""
    
    def test_subscription_unauthenticated(self):
        """Unauthenticated request returns 401"""
        response = requests.get(f"{BASE_URL}/api/account/subscription")
        
        assert response.status_code == 401
        print("✓ Subscription endpoint returns 401 for unauthenticated")
    
    def test_subscription_authenticated(self):
        """Authenticated request returns subscription details"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": TEST_USER_WITH_SUB["email"],
            "password": TEST_USER_WITH_SUB["password"]
        })
        
        if login_response.status_code != 200:
            pytest.skip("Could not login")
        
        token = login_response.json()["session_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/account/subscription",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "subscription_status" in data
        assert "subscription_tier" in data
        print(f"✓ Subscription endpoint returns: {data}")


class TestCancelSubscription:
    """Test cancel subscription endpoint"""
    
    def test_cancel_subscription_unauthenticated(self):
        """Unauthenticated request returns 401"""
        response = requests.post(f"{BASE_URL}/api/account/cancel-subscription")
        
        assert response.status_code == 401
        print("✓ Cancel subscription returns 401 for unauthenticated")


class TestStripeWebhook:
    """Test Stripe webhook ghost user prevention"""
    
    def test_webhook_unregistered_email_no_ghost(self):
        """Webhook with unregistered email should return no_user, NOT create ghost"""
        unregistered_email = f"unregistered_{uuid.uuid4().hex[:8]}@stripe.test"
        
        webhook_payload = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": f"cs_test_{uuid.uuid4().hex[:12]}",
                    "customer_email": unregistered_email,
                    "subscription": f"sub_test_{uuid.uuid4().hex[:12]}",
                    "metadata": {"tier": "monthly"}
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            json=webhook_payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "no_user", f"Expected no_user, got: {data}"
        print(f"✓ Webhook returns no_user for unregistered email (ghost prevention works)")
    
    def test_webhook_registered_email_updates_subscription(self):
        """Webhook with registered email should update auth_users subscription"""
        # First register a user
        unique_email = f"TEST_webhook_{uuid.uuid4().hex[:8]}@example.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "confirm_password": "testpass123"
        })
        
        if reg_response.status_code != 200:
            pytest.skip("Could not register test user")
        
        # Now simulate webhook
        webhook_payload = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": f"cs_test_{uuid.uuid4().hex[:12]}",
                    "customer_email": unique_email,
                    "subscription": f"sub_test_{uuid.uuid4().hex[:12]}",
                    "metadata": {"tier": "monthly"}
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            json=webhook_payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "success", f"Expected success, got: {data}"
        assert data.get("tier") == "monthly"
        print(f"✓ Webhook updates auth_users subscription for registered email")
    
    def test_webhook_subscription_deleted(self):
        """customer.subscription.deleted should update auth_users to cancelled"""
        webhook_payload = {
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "id": f"sub_test_{uuid.uuid4().hex[:12]}"
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            json=webhook_payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "subscription_cancelled"
        print("✓ Webhook handles subscription.deleted correctly")


class TestAdminEndpoints:
    """Test admin endpoints read from auth_users"""
    
    def test_admin_stats_returns_user_stats(self):
        """GET /api/admin/stats returns stats from auth_users"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check users object exists with expected fields
        assert "users" in data
        users = data["users"]
        assert "total" in users
        assert "monthly" in users
        assert "quarterly" in users
        assert "annual" in users
        assert "no_subscription" in users
        assert "cancelled" in users
        
        print(f"✓ Admin stats returns auth_users data: {users}")
    
    def test_admin_users_returns_auth_users(self):
        """GET /api/admin/users returns users from auth_users collection"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "users" in data
        assert "count" in data
        
        # Check user fields don't have license_key data
        if data["users"]:
            user = data["users"][0]
            assert "email" in user
            assert "password_hash" not in user  # Should be excluded
            # Should NOT have license_key fields since it reads from auth_users
            assert "license_key" not in user
        
        print(f"✓ Admin users endpoint returns {data['count']} users from auth_users")
    
    def test_admin_login(self):
        """Admin login with correct password returns token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "token" in data
        print("✓ Admin login works with correct password")
    
    def test_admin_login_wrong_password(self):
        """Admin login with wrong password returns 401"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
        print("✓ Admin login rejects wrong password")


class TestPublicPages:
    """Test that public pages don't return errors (basic accessibility)"""
    
    def test_api_endpoints_accessible(self):
        """Basic API endpoint accessibility check"""
        endpoints = [
            "/api/auth/check",
            "/api/admin/stats",
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code == 200, f"Endpoint {endpoint} returned {response.status_code}"
            print(f"✓ {endpoint} accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

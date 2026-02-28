"""
Test suite for Cycle Coach Auth and Account API endpoints
Tests:
- POST /api/auth/register - user registration
- POST /api/auth/login - user login
- GET /api/auth/check - auth status check
- POST /api/auth/forgot-password - password reset request
- POST /api/auth/reset-password - password reset
- GET /api/account/subscription - subscription details
- POST /api/account/cancel-subscription - cancel subscription (401 test)
- POST /api/webhook/stripe - Stripe webhook events
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://partner-guide-4.preview.emergentagent.com"


class TestAuthRegister:
    """Test /api/auth/register endpoint"""
    
    def test_register_success(self):
        """Test successful user registration"""
        unique_email = f"test_register_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": "testpass123",
                "confirm_password": "testpass123",
                "phone": None
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "session_token" in data
        assert "user" in data
        assert data["user"]["email"] == unique_email.lower()
    
    def test_register_password_mismatch(self):
        """Test registration with password mismatch"""
        unique_email = f"test_mismatch_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": "testpass123",
                "confirm_password": "differentpass",
                "phone": None
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "do not match" in data.get("detail", "").lower()
    
    def test_register_invalid_email(self):
        """Test registration with invalid email format"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": "invalidemail",
                "password": "testpass123",
                "confirm_password": "testpass123"
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "email" in data.get("detail", "").lower()
    
    def test_register_short_password(self):
        """Test registration with short password"""
        unique_email = f"test_short_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": "12345",
                "confirm_password": "12345"
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "6 characters" in data.get("detail", "").lower()
    
    def test_register_duplicate_email(self):
        """Test registration with already existing email"""
        # Use the existing test user
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": "testuser123@example.com",
                "password": "testpass123",
                "confirm_password": "testpass123"
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "already exists" in data.get("detail", "").lower()


class TestAuthLogin:
    """Test /api/auth/login endpoint"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": "testuser123@example.com",
                "password": "test1234"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "session_token" in data
        assert "user" in data
        assert data["user"]["email"] == "testuser123@example.com"
        # Check subscription info is included
        assert "has_subscription" in data["user"]
    
    def test_login_invalid_password(self):
        """Test login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": "testuser123@example.com",
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "invalid" in data.get("detail", "").lower()
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": "nonexistent@example.com",
                "password": "somepassword"
            }
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "invalid" in data.get("detail", "").lower()


class TestAuthCheck:
    """Test /api/auth/check endpoint"""
    
    def test_check_unauthenticated(self):
        """Test auth check without session token"""
        response = requests.get(f"{BASE_URL}/api/auth/check")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("authenticated") == False
        assert data.get("has_subscription") == False
    
    def test_check_with_valid_token(self):
        """Test auth check with valid session token"""
        # First login to get a token
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": "testuser123@example.com",
                "password": "test1234"
            }
        )
        assert login_response.status_code == 200
        token = login_response.json().get("session_token")
        
        # Now check auth status
        response = requests.get(
            f"{BASE_URL}/api/auth/check",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("authenticated") == True
        # Test user has active subscription
        assert data.get("has_subscription") == True
        # Check user object structure
        assert "user" in data
        assert data["user"]["email"] == "testuser123@example.com"
        # Check new fields are present
        assert "subscription_status" in data["user"]
        assert "subscription_tier" in data["user"]
    
    def test_check_with_invalid_token(self):
        """Test auth check with invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/check",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("authenticated") == False


class TestAuthForgotPassword:
    """Test /api/auth/forgot-password endpoint"""
    
    def test_forgot_password_existing_user(self):
        """Test forgot password for existing user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={"email": "testuser123@example.com"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "reset link" in data.get("message", "").lower() or "sent" in data.get("message", "").lower()
    
    def test_forgot_password_nonexistent_user(self):
        """Test forgot password for non-existent user (should still return success for security)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={"email": "nonexistent99999@example.com"}
        )
        
        # Should return success to prevent email enumeration
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True


class TestAuthResetPassword:
    """Test /api/auth/reset-password endpoint"""
    
    def test_reset_password_invalid_token(self):
        """Test password reset with invalid token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/reset-password",
            json={
                "token": "invalid_reset_token_12345",
                "new_password": "newpassword123"
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "invalid" in data.get("detail", "").lower() or "expired" in data.get("detail", "").lower()
    
    def test_reset_password_short_password(self):
        """Test password reset with short password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/reset-password",
            json={
                "token": "some_token",
                "new_password": "12345"
            }
        )
        
        # Should fail due to short password OR invalid token
        assert response.status_code == 400


class TestAccountSubscription:
    """Test /api/account/subscription endpoint"""
    
    def test_subscription_unauthenticated(self):
        """Test getting subscription without auth"""
        response = requests.get(f"{BASE_URL}/api/account/subscription")
        
        assert response.status_code == 401
        data = response.json()
        assert "authenticated" in data.get("detail", "").lower() or "not" in data.get("detail", "").lower()
    
    def test_subscription_authenticated(self):
        """Test getting subscription with valid auth"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": "testuser123@example.com",
                "password": "test1234"
            }
        )
        assert login_response.status_code == 200
        token = login_response.json().get("session_token")
        
        # Get subscription
        response = requests.get(
            f"{BASE_URL}/api/account/subscription",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        # Check required fields
        assert "email" in data
        assert "subscription_status" in data
        assert "subscription_tier" in data
        # Test user has monthly subscription
        assert data["email"] == "testuser123@example.com"


class TestAccountCancelSubscription:
    """Test /api/account/cancel-subscription endpoint"""
    
    def test_cancel_subscription_unauthenticated(self):
        """Test cancelling subscription without auth"""
        response = requests.post(f"{BASE_URL}/api/account/cancel-subscription")
        
        assert response.status_code == 401
        data = response.json()
        assert "authenticated" in data.get("detail", "").lower() or "not" in data.get("detail", "").lower()


class TestStripeWebhook:
    """Test /api/webhook/stripe endpoint"""
    
    def test_webhook_checkout_completed(self):
        """Test webhook for checkout.session.completed event"""
        test_email = f"webhook_test_{uuid.uuid4().hex[:8]}@example.com"
        webhook_payload = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": f"cs_test_{uuid.uuid4().hex}",
                    "customer_email": test_email,
                    "subscription": f"sub_test_{uuid.uuid4().hex}",
                    "metadata": {"tier": "monthly"}
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            json=webhook_payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Should succeed without signature verification for testing
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("status") == "success"
        assert "license_key" in data
        assert data.get("tier") == "monthly"
    
    def test_webhook_subscription_deleted(self):
        """Test webhook for customer.subscription.deleted event"""
        webhook_payload = {
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "id": "sub_nonexistent_12345"
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            json=webhook_payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "subscription_cancelled"


class TestPageLoading:
    """Test that frontend pages are accessible"""
    
    def test_home_page(self):
        """Test home page loads"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200
        assert "Cycle Coach" in response.text
    
    def test_about_page(self):
        """Test about page route exists"""
        response = requests.get(f"{BASE_URL}/about")
        assert response.status_code == 200
        # SPA returns index.html for all routes
        assert "<!doctype html>" in response.text.lower()
    
    def test_login_page(self):
        """Test login page route exists"""
        response = requests.get(f"{BASE_URL}/login")
        assert response.status_code == 200
    
    def test_signup_page(self):
        """Test signup page route exists"""
        response = requests.get(f"{BASE_URL}/signup")
        assert response.status_code == 200
    
    def test_pricing_page(self):
        """Test pricing page route exists"""
        response = requests.get(f"{BASE_URL}/pricing")
        assert response.status_code == 200
    
    def test_forgot_password_page(self):
        """Test forgot password page route exists"""
        response = requests.get(f"{BASE_URL}/forgot-password")
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

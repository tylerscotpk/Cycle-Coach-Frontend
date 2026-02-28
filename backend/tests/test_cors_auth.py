"""
Test Suite: CORS and Authentication for Cycle Coach
Testing cross-domain authentication fixes with SameSite=none Secure cookies
"""
import pytest
import requests
import os
import time
import uuid

# Backend API URL from environment  
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
LOCALHOST_URL = "http://localhost:8001"

# Test credentials
TEST_USER_EMAIL = "cors_test@test.com"
TEST_USER_PASSWORD = "test123456"


class TestCORSPreflight:
    """Test CORS preflight (OPTIONS) requests on localhost:8001 to verify middleware"""

    def test_cors_preflight_cyclecoach_net(self):
        """OPTIONS preflight from https://cyclecoach.net returns correct CORS headers"""
        response = requests.options(
            f"{LOCALHOST_URL}/api/auth/login",
            headers={
                "Origin": "https://cyclecoach.net",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            }
        )
        assert response.status_code == 204
        assert response.headers.get("access-control-allow-origin") == "https://cyclecoach.net"
        assert response.headers.get("access-control-allow-credentials") == "true"
        assert "POST" in response.headers.get("access-control-allow-methods", "")
        assert response.headers.get("vary") == "Origin"

    def test_cors_preflight_www_cyclecoach_net(self):
        """OPTIONS preflight from https://www.cyclecoach.net returns correct CORS headers"""
        response = requests.options(
            f"{LOCALHOST_URL}/api/auth/login",
            headers={
                "Origin": "https://www.cyclecoach.net",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            }
        )
        assert response.status_code == 204
        assert response.headers.get("access-control-allow-origin") == "https://www.cyclecoach.net"
        assert response.headers.get("access-control-allow-credentials") == "true"

    def test_cors_preflight_disallowed_origin(self):
        """OPTIONS from disallowed origin returns no CORS headers"""
        response = requests.options(
            f"{LOCALHOST_URL}/api/auth/login",
            headers={
                "Origin": "https://evil.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            }
        )
        assert response.status_code == 204
        # Disallowed origin should NOT have CORS headers
        assert response.headers.get("access-control-allow-origin") is None
        assert response.headers.get("access-control-allow-credentials") is None

    def test_cors_normal_get_from_allowed_origin(self):
        """Normal GET from allowed origin has Access-Control-Allow-Credentials: true"""
        response = requests.get(
            f"{LOCALHOST_URL}/api/auth/check",
            headers={"Origin": "https://cyclecoach.net"}
        )
        # Auth check with no token should return authenticated: false, but still valid response
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "https://cyclecoach.net"
        assert response.headers.get("access-control-allow-credentials") == "true"


class TestAuthRegister:
    """Test POST /api/auth/register - creates user, returns session_token, sets cookie"""

    def test_register_new_user(self):
        """Register creates user, returns session_token, and sets SameSite=none Secure cookie"""
        unique_email = f"TEST_cors_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": "test123456",
                "confirm_password": "test123456"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response data
        assert data.get("success") is True
        assert "session_token" in data
        assert len(data["session_token"]) > 0
        # Server lowercases emails, so compare case-insensitively
        assert data["user"]["email"].lower() == unique_email.lower()
        assert data["user"]["has_subscription"] is False

        # Verify cookie set with SameSite=none; Secure
        cookies = response.headers.get("set-cookie", "")
        cookies_lower = cookies.lower()
        assert "session_token=" in cookies
        assert "samesite=none" in cookies_lower
        assert "secure" in cookies_lower

    def test_register_duplicate_email_fails(self):
        """Register with existing email returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_USER_EMAIL,
                "password": "test123456",
                "confirm_password": "test123456"
            }
        )
        assert response.status_code == 400
        assert "already exists" in response.json().get("detail", "").lower()

    def test_register_password_mismatch_fails(self):
        """Register with mismatched passwords returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"TEST_mismatch_{uuid.uuid4().hex[:8]}@test.com",
                "password": "test123456",
                "confirm_password": "different123"
            }
        )
        assert response.status_code == 400
        assert "match" in response.json().get("detail", "").lower()


class TestAuthLogin:
    """Test POST /api/auth/login - authenticates user, returns session_token, sets cookie"""

    def test_login_success(self):
        """Login with valid credentials returns session_token and sets SameSite=none Secure cookie"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response data
        assert data.get("success") is True
        assert "session_token" in data
        assert len(data["session_token"]) > 0
        assert data["user"]["email"] == TEST_USER_EMAIL

        # Verify cookie set with SameSite=none; Secure
        cookies = response.headers.get("set-cookie", "")
        cookies_lower = cookies.lower()
        assert "session_token=" in cookies
        assert "samesite=none" in cookies_lower
        assert "secure" in cookies_lower

    def test_login_invalid_password_fails(self):
        """Login with wrong password returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": TEST_USER_EMAIL,
                "password": "wrongpassword"
            }
        )
        assert response.status_code == 401

    def test_login_nonexistent_user_fails(self):
        """Login with non-existent email returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": "nonexistent@test.com",
                "password": "test123456"
            }
        )
        assert response.status_code == 401


class TestAuthCheck:
    """Test GET /api/auth/check - returns authenticated status"""

    @pytest.fixture
    def session_token(self):
        """Get a valid session token by logging in"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
        )
        return response.json().get("session_token")

    def test_auth_check_with_bearer_token(self, session_token):
        """Auth check with valid Bearer token returns authenticated: true"""
        response = requests.get(
            f"{BASE_URL}/api/auth/check",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("authenticated") is True
        assert data["user"]["email"] == TEST_USER_EMAIL

    def test_auth_check_with_cookie(self, session_token):
        """Auth check with valid session_token cookie returns authenticated: true"""
        response = requests.get(
            f"{LOCALHOST_URL}/api/auth/check",
            cookies={"session_token": session_token}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("authenticated") is True
        assert data["user"]["email"] == TEST_USER_EMAIL

    def test_auth_check_no_token_returns_false(self):
        """Auth check with no token returns authenticated: false"""
        response = requests.get(f"{BASE_URL}/api/auth/check")
        assert response.status_code == 200
        data = response.json()
        assert data.get("authenticated") is False

    def test_auth_check_invalid_token_returns_false(self):
        """Auth check with invalid token returns authenticated: false"""
        response = requests.get(
            f"{BASE_URL}/api/auth/check",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("authenticated") is False


class TestAuthLogout:
    """Test POST /api/auth/logout - deletes session, clears cookie"""

    def test_logout_clears_cookie_with_samesite_none(self):
        """Logout clears cookie with SameSite=none Secure"""
        # First login to get a session
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
        )
        session_token = login_response.json().get("session_token")
        
        # Now logout
        response = requests.post(
            f"{BASE_URL}/api/auth/logout",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200
        assert response.json().get("message") == "Logged out successfully"
        
        # Verify cookie is cleared with SameSite=none; Secure
        cookies = response.headers.get("set-cookie", "")
        assert "session_token=" in cookies
        # Cookie should be expired (Max-Age=0 or expires in past)
        assert "Max-Age=0" in cookies or "expires=" in cookies.lower()
        assert "SameSite=none" in cookies.lower() or "samesite=none" in cookies
        assert "Secure" in cookies

    def test_session_invalid_after_logout(self):
        """Session token is invalid after logout"""
        # Login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
        )
        session_token = login_response.json().get("session_token")
        
        # Verify token works before logout
        check_before = requests.get(
            f"{BASE_URL}/api/auth/check",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert check_before.json().get("authenticated") is True
        
        # Logout
        requests.post(
            f"{BASE_URL}/api/auth/logout",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        # Verify token no longer works
        check_after = requests.get(
            f"{BASE_URL}/api/auth/check",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert check_after.json().get("authenticated") is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

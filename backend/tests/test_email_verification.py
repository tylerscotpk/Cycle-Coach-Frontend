"""Email verification endpoint tests (iOS deep-link flow iteration)."""
import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    return s


class TestVerifyEmail:
    def test_invalid_token_returns_400(self, client):
        r = client.get(f"{BASE_URL}/api/auth/verify-email?token=fake", timeout=30)
        print("STATUS", r.status_code, "CT", r.headers.get("content-type"), "BODY", r.text[:300])
        assert r.status_code == 400

    def test_invalid_token_returns_json_not_html(self, client):
        r = client.get(f"{BASE_URL}/api/auth/verify-email?token=fake", timeout=30)
        assert "application/json" in r.headers.get("content-type", "")
        data = r.json()
        assert isinstance(data, dict)
        assert "detail" in data or "message" in data or "success" in data

    def test_missing_token_param(self, client):
        r = client.get(f"{BASE_URL}/api/auth/verify-email", timeout=30)
        print("MISSING TOKEN STATUS", r.status_code, r.text[:200])
        assert r.status_code in (400, 422)


class TestResendVerification:
    def test_resend_known_user(self, client):
        r = client.post(f"{BASE_URL}/api/auth/resend-verification",
                        json={"email": "testuser@test.com"}, timeout=60)
        print("RESEND STATUS", r.status_code, r.text[:300])
        assert r.status_code in (200, 400)

    def test_resend_unknown_email_no_500(self, client):
        r = client.post(f"{BASE_URL}/api/auth/resend-verification",
                        json={"email": "TEST_nobody_xyz@example.com"}, timeout=60)
        print("RESEND UNKNOWN STATUS", r.status_code, r.text[:300])
        assert r.status_code < 500

    def test_resend_missing_body(self, client):
        r = client.post(f"{BASE_URL}/api/auth/resend-verification", json={}, timeout=30)
        print("RESEND EMPTY STATUS", r.status_code, r.text[:200])
        assert r.status_code < 500


class TestLoginStillWorks:
    def test_login(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login",
                        json={"email_or_phone": "testuser@test.com", "password": "Test1234"}, timeout=60)
        print("LOGIN", r.status_code, r.text[:300])
        assert r.status_code == 200
        data = r.json()
        assert data.get("user", {}).get("email") == "testuser@test.com" or "token" in data or "session_token" in data

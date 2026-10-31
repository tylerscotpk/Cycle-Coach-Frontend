# Public-URL checks for /api/account/* guard rails (no Stripe calls, non-destructive)
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
PW = "Test1234"


def _login(email):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email_or_phone": email, "password": PW})
    if r.status_code != 200:
        pytest.skip(f"login failed for {email}: {r.status_code}")
    return r.json()["session_token"]


# Delete: auth guard
def test_delete_no_auth_401():
    r = requests.post(f"{BASE_URL}/api/account/delete", json={"password": "x", "confirmation": "DELETE"})
    assert r.status_code == 401


# Delete: wrong confirmation text -> 400, account untouched
def test_delete_wrong_confirmation_400():
    tok = _login("adv_active@test.com")
    r = requests.post(f"{BASE_URL}/api/account/delete", headers={"Authorization": f"Bearer {tok}"},
                      json={"password": PW, "confirmation": "nope"})
    assert r.status_code == 400
    assert "DELETE" in r.json()["detail"]


# Delete: wrong password -> 401, account untouched
def test_delete_wrong_password_401():
    tok = _login("adv_active@test.com")
    r = requests.post(f"{BASE_URL}/api/account/delete", headers={"Authorization": f"Bearer {tok}"},
                      json={"password": "wrong", "confirmation": "DELETE"})
    assert r.status_code == 401
    assert "Incorrect password" in r.json()["detail"]
    # still able to log in
    assert requests.post(f"{BASE_URL}/api/auth/login",
                         json={"email_or_phone": "adv_active@test.com", "password": PW}).status_code == 200


# Delete: missing body fields -> 422
def test_delete_missing_fields_422():
    tok = _login("adv_active@test.com")
    r = requests.post(f"{BASE_URL}/api/account/delete", headers={"Authorization": f"Bearer {tok}"}, json={})
    assert r.status_code == 422


# Undo: auth guard
def test_undo_no_auth_401():
    assert requests.post(f"{BASE_URL}/api/account/undo-cancellation").status_code == 401


# Undo: lifetime user -> 400
def test_undo_lifetime_400():
    tok = _login("testuser@test.com")
    r = requests.post(f"{BASE_URL}/api/account/undo-cancellation", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 400
    assert "Lifetime" in r.json()["detail"]


# Undo: fake stripe id -> safe 502 (no crash)
def test_undo_fake_stripe_502():
    tok = _login("undo_cancel@test.com")
    r = requests.post(f"{BASE_URL}/api/account/undo-cancellation", headers={"Authorization": f"Bearer {tok}"})
    # NOTE: the edge proxy replaces 502 JSON bodies with an HTML error page, so the detail is lost on the public URL
    assert r.status_code == 502

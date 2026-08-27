"""Email verification idempotency tests (double-fire bug retest)."""
import os

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

fe = dotenv_values("/app/frontend/.env")
be = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or fe["REACT_APP_BACKEND_URL"]).rstrip("/")

EMAIL = "test_verify_idem@test.com"


@pytest.fixture(scope="module")
def db():
    client = MongoClient(be["MONGO_URL"])
    return client[be["DB_NAME"]]


@pytest.fixture(scope="module")
def registered(db):
    db.auth_users.delete_many({"email": EMAIL})
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": EMAIL, "password": "Test1234", "confirm_password": "Test1234"
    }, timeout=90)
    assert r.status_code in (200, 201), f"register failed {r.status_code} {r.text[:300]}"
    doc = db.auth_users.find_one({"email": EMAIL}, {"_id": 0})
    assert doc is not None
    assert doc.get("verification_token"), "no verification_token stored on register"
    assert doc.get("email_verified") is False
    yield doc
    db.auth_users.delete_many({"email": EMAIL})


def test_verify_first_call_success(registered):
    token = registered["verification_token"]
    r = requests.get(f"{BASE_URL}/api/auth/verify-email", params={"token": token}, timeout=30)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert data["success"] is True
    assert data.get("email") == EMAIL
    assert "already_verified" not in data


def test_verify_second_call_idempotent(registered, db):
    token = registered["verification_token"]
    r = requests.get(f"{BASE_URL}/api/auth/verify-email", params={"token": token}, timeout=30)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert data["success"] is True
    assert data.get("already_verified") is True
    # token must still be present in DB (not nulled)
    doc = db.auth_users.find_one({"email": EMAIL}, {"_id": 0})
    assert doc["verification_token"] == token
    assert doc["email_verified"] is True


def test_verify_third_call_still_success(registered):
    token = registered["verification_token"]
    r = requests.get(f"{BASE_URL}/api/auth/verify-email", params={"token": token}, timeout=30)
    assert r.status_code == 200
    assert r.json().get("already_verified") is True


def test_verify_invalid_token(registered):
    r = requests.get(f"{BASE_URL}/api/auth/verify-email", params={"token": "bogus-token-xyz"}, timeout=30)
    assert r.status_code == 400
    assert "Invalid" in r.json().get("detail", "")


def test_resend_for_verified_user(registered):
    r = requests.post(f"{BASE_URL}/api/auth/resend-verification", json={"email": EMAIL}, timeout=60)
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data.get("already_verified") is True

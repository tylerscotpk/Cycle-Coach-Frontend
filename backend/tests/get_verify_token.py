"""Helper: register a TEST_ user and print its verification token (for UI success-state test)."""
import os
import sys

import requests
from dotenv import dotenv_values
from pymongo import MongoClient

fe = dotenv_values("/app/frontend/.env")
be = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or fe["REACT_APP_BACKEND_URL"]).rstrip("/")

email = sys.argv[1] if len(sys.argv) > 1 else "test_verify_ui@test.com"

client = MongoClient(be["MONGO_URL"])
db = client[be["DB_NAME"]]
db.auth_users.delete_many({"email": email})

r = requests.post(f"{BASE_URL}/api/auth/register", json={
    "email": email, "password": "Test1234", "confirm_password": "Test1234"
}, timeout=60)
print("REGISTER", r.status_code, r.text[:300])

doc = db.auth_users.find_one({"email": email}, {"_id": 0, "verification_token": 1, "email_verified": 1, "id": 1})
print("DOC", doc)
if doc and doc.get("verification_token"):
    print("TOKEN=" + doc["verification_token"])

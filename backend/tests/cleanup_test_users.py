"""Cleanup throwaway users created by the regression suites (safe pattern only)."""
import asyncio
import os
import re

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

PATTERN = re.compile(r"^test_[a-z]+_[0-9a-f]{6,}@(test|example)\.com$")
KEEP = {"testuser@test.com", "trialtest@test.com", "ts_peterson@yahoo.com"}


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    emails = []
    async for u in db.auth_users.find({}, {"email": 1, "_id": 0}):
        e = (u.get("email") or "").lower()
        if e and e not in KEEP and PATTERN.match(e):
            emails.append(e)
    print("deleting", len(emails), "throwaway users")
    if emails:
        res = await db.auth_users.delete_many({"email": {"$in": emails}})
        print("deleted:", res.deleted_count)
    print("remaining users:", await db.auth_users.count_documents({}))
    client.close()


asyncio.run(main())

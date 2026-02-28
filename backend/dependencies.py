"""Shared auth dependencies used by multiple route modules."""
from fastapi import Cookie, Header, HTTPException
from typing import Optional
from datetime import datetime, timezone
from database import db
import logging
import httpx
import os

logger = logging.getLogger(__name__)


async def get_session_data_from_emergent(session_id: str):
    """Get user data from Emergent Auth API"""
    try:
        auth_api_url = os.environ.get('EMERGENT_AUTH_API_URL', 'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data')
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                auth_api_url,
                headers={"X-Session-ID": session_id}
            )
            if response.status_code == 200:
                return response.json()
            return None
    except Exception as e:
        logger.error(f"Error fetching session data: {e}")
        return None


async def get_current_user(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    """Get current user from session token (cookie or header)"""
    from server import User  # deferred import to avoid circular dependency

    token = session_token

    # Fallback to Authorization header
    if not token and authorization:
        if authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Check if session exists and is valid
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    # Check if session expired
    expires_at = session['expires_at']
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)

    # Ensure expires_at is timezone-aware
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": token})
        raise HTTPException(status_code=401, detail="Session expired")

    # Get user
    user = await db.users.find_one({"id": session['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return User(**user)

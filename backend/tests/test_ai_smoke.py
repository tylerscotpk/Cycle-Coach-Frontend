"""
AI Endpoint Smoke Test — runs post-deployment to catch LlmChat interface regressions.

Verifies:
  1. /api/chat/anonymous returns a real AI response (not the silent fallback)
  2. /api/tips/personalized returns a non-empty tips array (not the empty fallback)

The LlmChat call pattern `LlmChat(api_key, session_id, system_message).with_model('openai', 'gpt-5')`
has already caused a silent regression once (iteration 29). These tests catch that class of failure
because the try/except in the route returns HTTP 200 with a known fallback body instead of raising.
"""

import os
import pytest
import httpx

API_URL = os.environ.get(
    "TEST_API_URL",
    os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001"),
)

CHAT_FALLBACK = "I'm having trouble processing your request"


@pytest.mark.asyncio
async def test_chat_anonymous_returns_real_response():
    """POST /api/chat/anonymous must return an AI-generated response, not the error fallback."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{API_URL}/api/chat/anonymous",
            json={"message": "What phase is hardest for most couples?", "cycle_day": 14, "phase": "Ovulation"},
        )

    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    body = resp.json()
    assert "response" in body, f"Missing 'response' key in body: {body}"
    assert body["response"], "Response text is empty"
    assert CHAT_FALLBACK not in body["response"], (
        f"LlmChat interface is broken — endpoint returned the silent fallback: {body['response']!r}"
    )
    assert body.get("session_id", "") != "error", (
        f"session_id is 'error', indicating an exception in the chat handler"
    )
    # Sanity: a real response is longer than the fallback
    assert len(body["response"]) > 50, f"Response suspiciously short ({len(body['response'])} chars): {body['response']!r}"


@pytest.mark.asyncio
async def test_tips_personalized_returns_real_tips():
    """POST /api/tips/personalized must return at least one AI-generated tip, not an empty array."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{API_URL}/api/tips/personalized",
            json={"phase": "Follicular", "cycle_day": 8},
        )

    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    body = resp.json()
    assert "tips" in body, f"Missing 'tips' key in body: {body}"
    assert isinstance(body["tips"], list), f"'tips' is not a list: {type(body['tips'])}"
    assert len(body["tips"]) >= 1, (
        "LlmChat interface is broken — /tips/personalized returned zero tips (silent fallback)"
    )
    assert len(body["tips"][0]) > 10, f"First tip suspiciously short: {body['tips'][0]!r}"

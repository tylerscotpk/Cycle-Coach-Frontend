"""AI Wingman routes — anonymous chat, personalized tips."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from emergentintegrations.llm.chat import LlmChat, UserMessage
import os
import logging

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# ── Models ──────────────────────────────────────────────────────────

class PartnerProfileContext(BaseModel):
    partner_name: Optional[str] = None
    preferences: Optional[dict] = None
    cycle_length: Optional[int] = None

class AnonymousChatRequest(BaseModel):
    message: str
    cycle_day: Optional[int] = None
    phase: Optional[str] = None
    partner_profile: Optional[PartnerProfileContext] = None

class PersonalizedTipsRequest(BaseModel):
    phase: str
    cycle_day: int
    partner_name: Optional[str] = None
    preferences: Optional[dict] = None

# ── Anonymous chat ──────────────────────────────────────────────────

@router.post("/chat/anonymous")
async def anonymous_chat(request: AnonymousChatRequest):
    """Privacy-first anonymous chat — no auth, no persistence."""
    try:
        import secrets as _s
        anonymous_session = f"anon_{_s.token_hex(8)}"

        context = ""
        if request.cycle_day and request.phase:
            context = f"Current cycle context: Day {request.cycle_day} - {request.phase} phase\n\n"

        partner_context = ""
        if request.partner_profile:
            pp = request.partner_profile
            if pp.partner_name:
                partner_context += f"Partner's name: {pp.partner_name}\n"
            if pp.cycle_length:
                partner_context += f"Average cycle length: {pp.cycle_length} days\n"
            if pp.preferences:
                for k, v in pp.preferences.items():
                    partner_context += f"{k}: {v}\n"
            if partner_context:
                partner_context = f"Partner Profile:\n{partner_context}\n"

        system_prompt = f"""You are Cycle Coach AI, a knowledgeable and supportive relationship advisor 
specializing in helping men understand and navigate their partner's menstrual cycle.

{context}{partner_context}

Guidelines:
- Be direct, practical, and supportive
- Provide actionable advice specific to the current cycle phase when available
- Reference the partner by name if provided
- If preferences are provided, tailor advice accordingly
- Keep responses concise but helpful (2-4 paragraphs)
- End with a specific, actionable follow-up question to help the user think deeper
- Format the follow-up question on a new line starting with "Question:"
- Never provide medical advice - always recommend consulting a healthcare professional for medical concerns"""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=anonymous_session,
            system_message=system_prompt,
        ).with_model("openai", "gpt-5")

        response = await chat.send_message(
            UserMessage(text=request.message)
        )

        return {
            "response": response,
            "session_id": anonymous_session,
            "context_used": {
                "cycle_day": request.cycle_day,
                "phase": request.phase,
                "has_partner_profile": request.partner_profile is not None,
            },
        }
    except Exception as e:
        logging.error(f"Anonymous chat error: {e}")
        return {
            "response": "I'm having trouble processing your request right now. Please try again in a moment.",
            "session_id": "error",
            "context_used": {},
        }

# ── Personalized tips ───────────────────────────────────────────────

@router.post("/tips/personalized")
async def get_personalized_tips(request: PersonalizedTipsRequest):
    """Generate personalized tips for the current phase."""
    try:
        partner_ctx = ""
        if request.partner_name:
            partner_ctx += f"Partner name: {request.partner_name}\n"
        if request.preferences:
            for k, v in request.preferences.items():
                partner_ctx += f"{k}: {v}\n"

        prompt = f"""Generate 3-4 specific, actionable tips for a man whose partner is in the {request.phase} phase (Day {request.cycle_day}).

{partner_ctx}

Requirements:
- Each tip should be 1-2 sentences maximum
- Be specific and actionable (not generic advice)
- Reference the partner by name if provided
- Consider any stated preferences
- Include one tip about communication
- Include one tip about physical comfort/care
- Include one tip about emotional support
- Format as a simple numbered list (1. 2. 3. etc.)"""

        import secrets as _s
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"tips_{_s.token_hex(4)}",
            system_message="You are a concise relationship advisor specializing in cycle-aware tips. Be direct and helpful.",
        ).with_model("openai", "gpt-5")

        response = await chat.send_message(UserMessage(text=prompt))

        tips = []
        for line in response.split("\n"):
            clean = line.strip()
            if clean and (clean[0].isdigit() or clean.startswith("-")):
                clean = clean.lstrip("0123456789.-) ").strip()
                if clean:
                    tips.append(clean)

        return {"tips": tips[:4] if tips else [clean]}
    except Exception as e:
        logging.error(f"Personalized tips error: {e}")
        return {"tips": []}

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Cookie, Response, Header
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============ MODELS ============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PartnerProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    partner_name: str
    cycle_start_date: str  # Format: YYYY-MM-DD (most recent period)
    cycle_length: int = 28  # Average cycle length (calculated from history)
    preferences: dict = {}  # AI learned preferences
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CycleHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    partner_id: str
    cycle_start_date: str  # Format: YYYY-MM-DD
    cycle_length: Optional[int] = None  # Length of this specific cycle (calculated when next cycle starts)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AIConversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    partner_id: str
    message: str
    response: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Resource(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    type: str  # video, article, expert
    url: str
    thumbnail: Optional[str] = None
    phase: Optional[str] = None  # Which phase this resource is for (or None for general)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResource(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    resource_id: str
    status: str  # unread, archived, bookmarked
    viewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Request/Response Models
class PartnerProfileCreate(BaseModel):
    partner_name: str
    cycle_start_date: str
    cycle_length: int = 28

class PartnerProfileUpdate(BaseModel):
    partner_name: Optional[str] = None
    cycle_start_date: Optional[str] = None
    cycle_length: Optional[int] = None

class ChatMessage(BaseModel):
    message: str
    partner_id: str

class PreferenceUpdate(BaseModel):
    key: str
    value: str

# ============ AUTH HELPERS ============

async def get_session_data_from_emergent(session_id: str):
    """Get user data from Emergent Auth API"""
    try:
        auth_api_url = os.environ.get('EMERGENT_AUTH_API_URL', 'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data')
        async with httpx.AsyncClient() as client:
            response = await client.get(
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

# ============ AUTH ROUTES ============

@api_router.post("/auth/process-session")
async def process_session(session_id: str, response: Response):
    """Process session_id from Emergent Auth and create user session"""
    # Get user data from Emergent
    user_data = await get_session_data_from_emergent(session_id)
    if not user_data:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data['email']}, {"_id": 0})
    
    if not existing_user:
        # Create new user
        user = User(
            id=user_data['id'],
            email=user_data['email'],
            name=user_data['name'],
            picture=user_data.get('picture')
        )
        user_dict = user.model_dump()
        user_dict['created_at'] = user_dict['created_at'].isoformat()
        await db.users.insert_one(user_dict)
    else:
        user = User(**existing_user)
    
    # Create session
    session_token = user_data['session_token']
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session = UserSession(
        user_id=user.id,
        session_token=session_token,
        expires_at=expires_at
    )
    
    session_dict = session.model_dump()
    session_dict['expires_at'] = session_dict['expires_at'].isoformat()
    session_dict['created_at'] = session_dict['created_at'].isoformat()
    await db.user_sessions.insert_one(session_dict)
    
    # Set httpOnly cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    return {"user": user.model_dump(), "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user

@api_router.post("/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(None)):
    """Logout user"""
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ============ PARTNER PROFILE ROUTES ============

@api_router.post("/partner", response_model=PartnerProfile)
async def create_partner_profile(
    profile_data: PartnerProfileCreate,
    current_user: User = Depends(get_current_user)
):
    """Create partner profile"""
    # Check if profile already exists
    existing = await db.partner_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Partner profile already exists")
    
    profile = PartnerProfile(
        user_id=current_user.id,
        **profile_data.model_dump()
    )
    
    profile_dict = profile.model_dump()
    profile_dict['created_at'] = profile_dict['created_at'].isoformat()
    profile_dict['updated_at'] = profile_dict['updated_at'].isoformat()
    await db.partner_profiles.insert_one(profile_dict)
    
    # Create initial cycle history entry
    initial_cycle = CycleHistory(
        partner_id=profile.id,
        cycle_start_date=profile_data.cycle_start_date,
        cycle_length=None
    )
    cycle_dict = initial_cycle.model_dump()
    cycle_dict['created_at'] = cycle_dict['created_at'].isoformat()
    await db.cycle_history.insert_one(cycle_dict)
    
    return profile

@api_router.get("/partner", response_model=PartnerProfile)
async def get_partner_profile(current_user: User = Depends(get_current_user)):
    """Get partner profile"""
    profile = await db.partner_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Partner profile not found")
    
    return PartnerProfile(**profile)

@api_router.put("/partner/{partner_id}", response_model=PartnerProfile)
async def update_partner_profile(
    partner_id: str,
    profile_data: PartnerProfileUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update partner profile"""
    profile = await db.partner_profiles.find_one(
        {"id": partner_id, "user_id": current_user.id},
        {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Partner profile not found")
    
    update_data = profile_data.model_dump(exclude_unset=True)
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.partner_profiles.update_one(
        {"id": partner_id},
        {"$set": update_data}
    )
    
    updated_profile = await db.partner_profiles.find_one({"id": partner_id}, {"_id": 0})
    return PartnerProfile(**updated_profile)

# ============ CYCLE TRACKING ROUTES ============

@api_router.post("/cycle/log-period")
async def log_period_start(
    partner_id: str,
    start_date: str,  # Format: YYYY-MM-DD
    current_user: User = Depends(get_current_user)
):
    """Log a new period start date"""
    profile = await db.partner_profiles.find_one(
        {"id": partner_id, "user_id": current_user.id},
        {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Partner profile not found")
    
    # Parse dates
    new_start = datetime.strptime(start_date, "%Y-%m-%d").date()
    old_start = datetime.strptime(profile['cycle_start_date'], "%Y-%m-%d").date()
    
    # Calculate length of previous cycle
    cycle_length = (new_start - old_start).days
    
    # Update the last cycle history entry with its length
    await db.cycle_history.update_one(
        {"partner_id": partner_id, "cycle_start_date": profile['cycle_start_date']},
        {"$set": {"cycle_length": cycle_length}}
    )
    
    # Create new cycle history entry
    new_cycle = CycleHistory(
        partner_id=partner_id,
        cycle_start_date=start_date,
        cycle_length=None  # Will be calculated when next period starts
    )
    cycle_dict = new_cycle.model_dump()
    cycle_dict['created_at'] = cycle_dict['created_at'].isoformat()
    await db.cycle_history.insert_one(cycle_dict)
    
    # Calculate average cycle length from history (last 6 cycles)
    history = await db.cycle_history.find(
        {"partner_id": partner_id, "cycle_length": {"$ne": None}},
        {"_id": 0}
    ).sort("cycle_start_date", -1).limit(6).to_list(6)
    
    if history:
        avg_length = sum(h['cycle_length'] for h in history) // len(history)
    else:
        avg_length = 28  # Default if no history yet
    
    # Update partner profile with new start date and calculated average
    await db.partner_profiles.update_one(
        {"id": partner_id},
        {"$set": {
            "cycle_start_date": start_date,
            "cycle_length": avg_length,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Period logged successfully",
        "new_cycle_start": start_date,
        "previous_cycle_length": cycle_length,
        "average_cycle_length": avg_length
    }

@api_router.get("/cycle/history")
async def get_cycle_history(
    partner_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get cycle history and statistics"""
    profile = await db.partner_profiles.find_one(
        {"id": partner_id, "user_id": current_user.id},
        {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Partner profile not found")
    
    # Get cycle history (last 12 cycles)
    history = await db.cycle_history.find(
        {"partner_id": partner_id},
        {"_id": 0}
    ).sort("cycle_start_date", -1).limit(12).to_list(12)
    
    # Calculate statistics
    completed_cycles = [h for h in history if h.get('cycle_length')]
    
    if completed_cycles:
        lengths = [c['cycle_length'] for c in completed_cycles]
        avg_length = sum(lengths) // len(lengths)
        min_length = min(lengths)
        max_length = max(lengths)
        variability = max_length - min_length
    else:
        avg_length = profile['cycle_length']
        min_length = avg_length
        max_length = avg_length
        variability = 0
    
    # Predict next period
    current_start = datetime.strptime(profile['cycle_start_date'], "%Y-%m-%d").date()
    predicted_next = current_start + timedelta(days=avg_length)
    
    return {
        "history": history,
        "statistics": {
            "average_length": avg_length,
            "min_length": min_length,
            "max_length": max_length,
            "variability": variability,
            "is_irregular": variability > 7,  # More than 7 days variation = irregular
            "total_cycles_tracked": len(completed_cycles)
        },
        "prediction": {
            "next_period_date": predicted_next.isoformat(),
            "days_until_next": (predicted_next - datetime.now(timezone.utc).date()).days
        }
    }

@api_router.get("/cycle/current")
async def get_current_cycle(
    partner_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get current cycle phase and information"""
    profile = await db.partner_profiles.find_one(
        {"id": partner_id, "user_id": current_user.id},
        {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Partner profile not found")
    
    # Calculate cycle information
    cycle_start = datetime.strptime(profile['cycle_start_date'], "%Y-%m-%d").date()
    today = datetime.now(timezone.utc).date()
    days_since_start = (today - cycle_start).days
    cycle_day = (days_since_start % profile['cycle_length']) + 1
    
    # Determine phase
    phase_info = get_phase_info(cycle_day)
    
    return {
        "cycle_day": cycle_day,
        "phase": phase_info['phase'],
        "phase_day": phase_info['phase_day'],
        "description": phase_info['description'],
        "emotional_state": phase_info['emotional_state'],
        "physical_state": phase_info['physical_state'],
        "tips": phase_info['tips']
    }

def get_phase_info(cycle_day: int):
    """Get phase information based on cycle day"""
    if 1 <= cycle_day <= 5:
        return {
            "phase": "Menstrual",
            "phase_day": cycle_day,
            "description": "Red alert - literally. She's on her period.",
            "emotional_state": "Low energy, might bite your head off",
            "physical_state": "Cramping, tired AF, not feeling sexy",
            "tips": [
                "**Do the dishes.** Like, NOW. Don't wait to be asked.",
                "Get her **favorite snacks**. Ben & Jerry's never hurt nobody.",
                "**Netflix marathon** = your best move. Let her pick, even if it's that sad dog movie again.",
                "No jokes about her being 'emotional' unless you want to **sleep on the couch**",
                "**Heating pad + backrub** = you're a goddamn hero. She'll remember this.",
                "She says she's fine? **She's not fine.** Bring chocolate.",
                "Think of yourself as her **emotional support human**. Just be there.",
                "**🏋️ YOUR MOVE: Hit the gym hard.** She needs space anyway - use it to work on yourself."
            ]
        }
    elif 6 <= cycle_day <= 13:
        return {
            "phase": "Follicular",
            "phase_day": cycle_day - 5,
            "description": "The storm has passed. She's back, baby!",
            "emotional_state": "Happy, energetic, fun to be around",
            "physical_state": "Feeling good, looking good, knows it",
            "tips": [
                "**Book that fancy restaurant** NOW while she's saying yes to everything",
                "She'll actually want to **leave the house** - capitalize on this window",
                "Good time to bring up **that thing you've been avoiding** (yes, that thing)",
                "**Compliments land HARD** right now - tell her she looks amazing",
                "Try that **new thing in bed** she mentioned 3 months ago. Trust me.",
                "She's basically a **yes-man** right now. Propose that guys' trip. Do it.",
                "Think 'Happy Wife Life' - **she's in her power phase**, ride the wave",
                "**💬 YOUR MOVE: Seek her counsel.** She's sharp, optimistic, and ready to problem-solve. Ask about that work thing.",
                "**🏋️ YOUR MOVE: Show off those gains.** She'll notice you looking good. New haircut? She's paying attention."
            ]
        }
    elif 14 <= cycle_day <= 16:
        return {
            "phase": "Ovulation",
            "phase_day": cycle_day - 13,
            "description": "🔥 PRIME TIME 🔥 This is it chief",
            "emotional_state": "Feeling herself, confident AF, wants attention",
            "physical_state": "Peak everything. Energy, looks, sex drive.",
            "tips": [
                "**BRO. This is THE window.** Clear your schedule. Cancel your plans. This is go time.",
                "She's ovulating = **nature's horny button is pressed**. Biology is on your side.",
                "Tell her she looks **hot**. Then tell her again. Then one more time.",
                "**Plan something romantic tonight** (you know exactly why)",
                "This is when she's most likely to say **yes to anything** 😏 - make your move",
                "Do NOT, I repeat, **DO NOT** mess this up with **lazy boyfriend energy**",
                "Put the **phone down**. Give her your **FULL attention**. Be present.",
                "Think of it like **playoff mode** - this is your time to shine, champion",
                "**💪 YOUR MOVE: Brag a little.** Landed that deal? Nailed the presentation? She finds your confidence SEXY right now.",
                "**🏋️ YOUR MOVE: Look sharp, smell good.** Fresh haircut, nice cologne. She's biologically wired to notice masculine energy."
            ]
        }
    elif 17 <= cycle_day <= 23:
        return {
            "phase": "Early Luteal",
            "phase_day": cycle_day - 16,
            "description": "Chill vibes. Enjoy it while it lasts.",
            "emotional_state": "Relaxed, nurturing, nesting mode activated",
            "physical_state": "Still good, starting to wind down",
            "tips": [
                "She's in **nesting mode** - help with home projects without complaining",
                "**Notice when she cleans/cooks** - say thank you like you actually mean it",
                "Low-key **date nights > wild adventures** right now. Keep it cozy.",
                "She might get **Stage 5 Clinger** status - that's normal, lean into it",
                "**Don't plan anything crazy** - she wants routine and predictability",
                "Think **Jim & Pam energy** - comfortable, domestic, wholesome vibes",
                "**Quality time on the couch** > going out. She wants YOU, not a scene.",
                "**💬 YOUR MOVE: Seek her advice.** She's in nurturing mode - ask about life decisions, career moves, friend drama."
            ]
        }
    else:  # 24-28
        return {
            "phase": "Late Luteal/PMS",
            "phase_day": cycle_day - 23,
            "description": "⚠️ DEFCON 1 ⚠️ Tread carefully, soldier",
            "emotional_state": "Irritable, emotional, zero chill",
            "physical_state": "Bloated, tired, breaking out, generally over it",
            "tips": [
                "Whatever she says, **she's right**. I don't care if she's wrong - **SHE'S RIGHT.**",
                "Is she crying at a **dog food commercial**? Normal. Just hug her. Don't ask questions.",
                "Buy **tampons BEFORE she asks**. You're basically Nostradamus at this point.",
                "**Cancel plans** if she's not feeling it. Don't be a hero. Just. Don't.",
                "**Food delivery apps** are your best friend this week. Use them liberally.",
                "Don't ask **'is it that time of the month?'** - that's a **death wish**, bro",
                "She wants to fight? Brother, **you've already lost**. Apologize and move on.",
                "Stock up on her **favorite junk food** like the apocalypse is coming",
                "Think **Incredible Hulk** - don't poke the bear. Just don't.",
                "**🏋️ YOUR MOVE: Hit the gym HARD.** She needs space. Channel that energy into gains. Come back stronger.",
                "**🚫 YOUR MOVE: Do NOT brag.** Keep wins to yourself this week. Save the victory lap for next week."
            ]
        }

# ============ AI CHAT ROUTES ============

@api_router.post("/chat")
async def chat_with_ai(
    chat_data: ChatMessage,
    current_user: User = Depends(get_current_user)
):
    """Chat with AI to learn partner preferences"""
    # Get partner profile
    profile = await db.partner_profiles.find_one(
        {"id": chat_data.partner_id, "user_id": current_user.id},
        {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Partner profile not found")
    
    # Calculate current cycle day
    cycle_start = datetime.strptime(profile['cycle_start_date'], "%Y-%m-%d").date()
    today = datetime.now(timezone.utc).date()
    days_since_start = (today - cycle_start).days
    current_cycle_day = (days_since_start % profile['cycle_length']) + 1
    profile['current_cycle_day'] = current_cycle_day
    
    # Get current phase info for context
    phase_info = get_phase_info(current_cycle_day)
    
    # Create chat session
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"{current_user.id}_{chat_data.partner_id}",
        system_message=f"""You're the ultimate relationship wingman - like texting your wise older bro at 2am.

Your girl's name: {profile['partner_name']}
Current cycle: Day {current_cycle_day} - {phase_info['phase']} phase

RESPONSE FORMAT (CRITICAL):
- Each bullet point MUST be on its own line
- Use actual bullet points (•)
- Keep responses to 2-4 bullet points MAX
- If you have a question, put it AFTER the advice on a new line starting with "Question:"

Example format:
• First tip here

• Second tip here

• Third tip here

Question: What's her favorite way to decompress after work?

RESPONSE STYLE:
- Be direct, funny, helpful
- Talk like you're texting, not writing an essay
- NO fluff or long paragraphs

YOUR JOBS:

1. **Learn about her**: Ask smart questions to build her profile
   - What's her coffee order?
   - Does she want space or cuddles when stressed?
   - Favorite comfort foods?
   - Love language?
   - What movies/shows/music does she love?

2. **Give tactical advice**: When he asks for help, give 2-3 specific actions
   Example format:
   • Acknowledge you messed up (even if you didn't)
   
   • Ask what she needs right now
   
   • Do NOT try to logic your way out

3. **Entertainment recommendations**: When he asks "what should we watch/listen to?"
   - Reference her favorites from her profile
   - Suggest similar movies/shows/music she'd like
   - Mention new releases in her preferred genres
   - Tailor to current cycle phase (cozy rom-coms during PMS, adventure during follicular)

4. **Track what works**: After events/dates, ask "How'd it go?" or "What worked?"
   Store wins and fails in her profile so you can suggest what actually works for HER.

5. **Reference resources**: If he needs deeper help, point him to the Resources tab

6. **Update her profile**: When you learn new info, suggest updates

WHAT YOU KNOW:
Preferences: {profile.get('preferences', {})}
Current Phase Context: {phase_info['phase']} - {phase_info['description']}
Today's Phase Tips: {phase_info['tips'][:2]}

ENTERTAINMENT KNOWLEDGE:
Movies: {profile.get('preferences', {}).get('favorite_movies', 'Unknown')}
TV Shows: {profile.get('preferences', {}).get('tv_series', 'Unknown')}
Music Artists: {profile.get('preferences', {}).get('music_artists', 'Unknown')}
Music Genres: {profile.get('preferences', {}).get('music_genres', 'Unknown')}
Podcasts: {profile.get('preferences', {}).get('podcast_shows', 'Unknown')}

REMEMBER: Bullet points on separate lines. Questions on new line starting with "Question:". Like texting your boy. Go."""
    ).with_model("openai", "gpt-5")
    
    # Send message
    user_message = UserMessage(text=chat_data.message)
    ai_response = await chat.send_message(user_message)
    
    # Save conversation
    conversation = AIConversation(
        user_id=current_user.id,
        partner_id=chat_data.partner_id,
        message=chat_data.message,
        response=ai_response
    )
    
    conv_dict = conversation.model_dump()
    conv_dict['timestamp'] = conv_dict['timestamp'].isoformat()
    await db.ai_conversations.insert_one(conv_dict)
    
    return {"response": ai_response}

@api_router.get("/chat/history")
async def get_chat_history(
    partner_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get chat history"""
    history = await db.ai_conversations.find(
        {"user_id": current_user.id, "partner_id": partner_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(50).to_list(50)
    
    return history

@api_router.post("/preferences")
async def update_preferences(
    partner_id: str,
    pref_data: PreferenceUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update partner preferences"""
    profile = await db.partner_profiles.find_one(
        {"id": partner_id, "user_id": current_user.id},
        {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Partner profile not found")
    
    preferences = profile.get('preferences', {})
    preferences[pref_data.key] = pref_data.value
    
    await db.partner_profiles.update_one(
        {"id": partner_id},
        {"$set": {"preferences": preferences, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Preference updated", "preferences": preferences}

# ============ FUN FACTS ROUTES ============

@api_router.get("/fun-fact")
async def get_fun_fact(
    partner_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get a fun fact, optionally phase-specific"""
    current_phase = None
    
    if partner_id:
        profile = await db.partner_profiles.find_one(
            {"id": partner_id, "user_id": current_user.id},
            {"_id": 0}
        )
        if profile:
            cycle_start = datetime.strptime(profile['cycle_start_date'], "%Y-%m-%d").date()
            today = datetime.now(timezone.utc).date()
            days_since_start = (today - cycle_start).days
            cycle_day = (days_since_start % profile['cycle_length']) + 1
            phase_info = get_phase_info(cycle_day)
            current_phase = phase_info['phase']
    
    facts = get_fun_facts(current_phase)
    
    # Return a random fact
    import random
    return {"fact": random.choice(facts), "phase": current_phase}

def get_fun_facts(phase: Optional[str] = None):
    """Get fun facts, optionally filtered by phase"""
    
    general_facts = [
        "Women can smell testosterone. During ovulation, she's biologically wired to notice masculine traits more.",
        "Her pain tolerance is 9% higher during ovulation. She's literally tougher when she's most fertile.",
        "Studies show couples who understand the cycle have 43% fewer arguments. Knowledge is power, bro.",
        "During PMS, her brain processes emotions differently - it's actual neuroscience, not 'being dramatic'.",
        "The average woman spends 6.25 years of her life on her period. Yeah, bring the chocolate.",
        "Her sense of smell is 100x more sensitive during certain phases. That cologne choice matters.",
        "Couples who track cycles together report 31% higher relationship satisfaction. You're doing it right.",
        "During follicular phase, women are statistically more likely to take risks. Ask for that raise together.",
        "The menstrual cycle affects everything from food cravings to music taste. She's not being 'random'.",
        "Men who understand their partner's cycle are rated 28% more attractive. Science says you're getting hotter."
    ]
    
    phase_facts = {
        "Menstrual": [
            "Her cramps can be as painful as a heart attack. Yes, seriously. Bring the heating pad.",
            "During menstruation, her body is shedding and rebuilding tissue - it's literally working overtime.",
            "Orgasms can help relieve menstrual cramps. Just saying. Natural pain relief.",
            "She burns an extra 100-300 calories per day during her period. Feed her accordingly.",
            "Her iron levels drop during menstruation. Red meat, spinach, dark chocolate = your shopping list."
        ],
        "Follicular": [
            "Estrogen peaks during follicular phase, boosting her mood, energy, and confidence. She's basically superhuman right now.",
            "Her verbal fluency increases during follicular phase. She's literally wittier this week.",
            "Women are more likely to wear red during follicular phase. Subconscious confidence boost.",
            "Her memory is sharper during this phase. Remember: she WILL remember what you say.",
            "Studies show women make better financial decisions during follicular phase. Ask for budget advice now."
        ],
        "Ovulation": [
            "During ovulation, her voice pitch actually gets higher. Biology's way of signaling fertility.",
            "She's most attracted to 'masculine' features during ovulation. Hit the gym, champ.",
            "Ovulation only lasts 12-24 hours, but the 'fertile window' is 5-6 days. Plan accordingly.",
            "Women are subconsciously attracted to symmetrical faces during ovulation. Straighten that tie.",
            "Her pupils dilate more during ovulation. She's literally seeing you differently."
        ],
        "Early Luteal": [
            "Progesterone rises during luteal phase, creating 'nesting' instincts. Help with the house, win points.",
            "She's most likely to want to cuddle during this phase. Body temp rises, she wants warmth.",
            "Women report feeling more nurturing during luteal phase. Good time to talk about the future.",
            "Her appetite increases during this phase - it's hormonal, not lack of willpower.",
            "Studies show women prefer 'comfort food' during luteal phase. Mac & cheese time."
        ],
        "Late Luteal/PMS": [
            "PMS affects 75% of women. If she says she's not affected, she's lying or lucky AF.",
            "Serotonin drops during PMS, affecting mood regulation. It's brain chemistry, not attitude.",
            "Women are more sensitive to pain during PMS. Everything literally hurts more.",
            "Cravings during PMS are your body's way of asking for magnesium. Hence: chocolate.",
            "PMS symptoms can start up to 2 weeks before her period. Early warning system, use it."
        ]
    }
    
    if phase and phase in phase_facts:
        return general_facts + phase_facts[phase]
    
    return general_facts

# ============ RESOURCES ROUTES ============

# ============ RESOURCES ROUTES ============

@api_router.get("/resources/next")
async def get_next_resource(
    partner_id: str,
    limit: int = 3,
    current_user: User = Depends(get_current_user)
):
    """Get next unread resources, prioritizing current phase, then upcoming phase, then general"""
    # Get partner profile to determine current phase
    profile = await db.partner_profiles.find_one(
        {"id": partner_id, "user_id": current_user.id},
        {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Partner profile not found")
    
    # Calculate current phase
    cycle_start = datetime.strptime(profile['cycle_start_date'], "%Y-%m-%d").date()
    today = datetime.now(timezone.utc).date()
    days_since_start = (today - cycle_start).days
    cycle_day = (days_since_start % profile['cycle_length']) + 1
    phase_info = get_phase_info(cycle_day)
    current_phase = phase_info['phase']
    
    # Calculate upcoming phase (next phase in cycle)
    upcoming_phase = get_upcoming_phase(cycle_day)
    
    # Get user's viewed/archived resource IDs
    user_resources = await db.user_resources.find(
        {"user_id": current_user.id, "status": {"$in": ["archived", "viewed"]}},
        {"_id": 0, "resource_id": 1}
    ).to_list(1000)
    viewed_ids = [ur['resource_id'] for ur in user_resources]
    
    result_resources = []
    
    # Priority 1: Current phase-specific resources
    current_phase_resources = await db.resources.find(
        {"phase": current_phase, "id": {"$nin": viewed_ids}},
        {"_id": 0}
    ).to_list(limit)
    
    for res in current_phase_resources:
        res['current_phase'] = current_phase
        res['is_phase_match'] = True
        res['priority'] = 'current'
        result_resources.append(res)
    
    # Priority 2: Upcoming phase resources (prepare for next phase)
    if len(result_resources) < limit and upcoming_phase:
        remaining = limit - len(result_resources)
        upcoming_resources = await db.resources.find(
            {"phase": upcoming_phase, "id": {"$nin": viewed_ids}},
            {"_id": 0}
        ).to_list(remaining)
        
        for res in upcoming_resources:
            res['current_phase'] = current_phase
            res['is_phase_match'] = False
            res['is_upcoming'] = True
            res['upcoming_phase'] = upcoming_phase
            res['priority'] = 'upcoming'
            result_resources.append(res)
    
    # Priority 3: General resources and random other resources
    if len(result_resources) < limit:
        remaining = limit - len(result_resources)
        
        # Get all unviewed general and other phase resources
        all_other = await db.resources.find(
            {
                "$or": [
                    {"phase": None},
                    {"phase": {"$nin": [current_phase, upcoming_phase]}}
                ],
                "id": {"$nin": viewed_ids}
            },
            {"_id": 0}
        ).to_list(remaining * 2)  # Get more for randomization
        
        # Randomize and take only what we need
        import random
        if all_other:
            random.shuffle(all_other)
            for res in all_other[:remaining]:
                res['current_phase'] = current_phase
                res['is_phase_match'] = False
                res['is_upcoming'] = False
                res['priority'] = 'general'
                result_resources.append(res)
    
    return result_resources

def get_upcoming_phase(cycle_day: int):
    """Get the next phase in the cycle"""
    if 1 <= cycle_day <= 5:
        return "Follicular"
    elif 6 <= cycle_day <= 13:
        return "Ovulation"
    elif 14 <= cycle_day <= 16:
        return "Early Luteal"
    elif 17 <= cycle_day <= 23:
        return "Late Luteal/PMS"
    else:  # 24-28
        return "Menstrual"

@api_router.post("/resources/{resource_id}/archive")
async def archive_resource(
    resource_id: str,
    current_user: User = Depends(get_current_user)
):
    """Archive a resource"""
    # Check if user resource record exists
    existing = await db.user_resources.find_one(
        {"user_id": current_user.id, "resource_id": resource_id}
    )
    
    if existing:
        # Update status
        await db.user_resources.update_one(
            {"user_id": current_user.id, "resource_id": resource_id},
            {"$set": {"status": "archived", "viewed_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # Create new record
        user_resource = UserResource(
            user_id=current_user.id,
            resource_id=resource_id,
            status="archived",
            viewed_at=datetime.now(timezone.utc)
        )
        ur_dict = user_resource.model_dump()
        ur_dict['viewed_at'] = ur_dict['viewed_at'].isoformat()
        ur_dict['created_at'] = ur_dict['created_at'].isoformat()
        await db.user_resources.insert_one(ur_dict)
    
    return {"message": "Resource archived"}

@api_router.post("/resources/{resource_id}/bookmark")
async def bookmark_resource(
    resource_id: str,
    current_user: User = Depends(get_current_user)
):
    """Bookmark a resource"""
    # Check if user resource record exists
    existing = await db.user_resources.find_one(
        {"user_id": current_user.id, "resource_id": resource_id}
    )
    
    if existing:
        # Update status
        await db.user_resources.update_one(
            {"user_id": current_user.id, "resource_id": resource_id},
            {"$set": {"status": "bookmarked", "viewed_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # Create new record
        user_resource = UserResource(
            user_id=current_user.id,
            resource_id=resource_id,
            status="bookmarked",
            viewed_at=datetime.now(timezone.utc)
        )
        ur_dict = user_resource.model_dump()
        ur_dict['viewed_at'] = ur_dict['viewed_at'].isoformat()
        ur_dict['created_at'] = ur_dict['created_at'].isoformat()
        await db.user_resources.insert_one(ur_dict)
    
    return {"message": "Resource bookmarked"}

@api_router.get("/resources/bookmarked")
async def get_bookmarked_resources(current_user: User = Depends(get_current_user)):
    """Get user's bookmarked resources"""
    user_resources = await db.user_resources.find(
        {"user_id": current_user.id, "status": "bookmarked"},
        {"_id": 0}
    ).to_list(100)
    
    resource_ids = [ur['resource_id'] for ur in user_resources]
    resources = await db.resources.find(
        {"id": {"$in": resource_ids}},
        {"_id": 0}
    ).to_list(100)
    
    return resources

@api_router.get("/resources", response_model=List[Resource])
async def get_resources(current_user: User = Depends(get_current_user)):
    """Get all resources"""
    resources = await db.resources.find({}, {"_id": 0}).to_list(100)
    return resources

@api_router.post("/resources/seed")
async def seed_resources():
    """Seed initial resources (admin only - remove in production)"""
    # Check if resources exist
    count = await db.resources.count_documents({})
    if count > 0:
        return {"message": "Resources already seeded"}
    
    resources = [
        # General resources
        Resource(
            title="Understanding the Menstrual Cycle",
            description="A comprehensive guide to the four phases of the menstrual cycle",
            type="article",
            url="https://www.healthline.com/health/womens-health/stages-of-menstrual-cycle",
            thumbnail="https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400",
            phase=None
        ),
        Resource(
            title="How to Support Your Partner During PMS",
            description="Expert advice on being there when she needs you most",
            type="article",
            url="https://www.verywellmind.com/pms-support-partner-5207965",
            thumbnail="https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400",
            phase="Late Luteal/PMS"
        ),
        Resource(
            title="The Science of Attraction",
            description="Understanding hormones and attraction throughout the cycle",
            type="video",
            url="https://www.youtube.com/watch?v=example",
            thumbnail="https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=400",
            phase="Ovulation"
        ),
        # Menstrual Phase Resources
        Resource(
            title="Natural Pain Relief for Period Cramps",
            description="Drug-free ways to help ease her discomfort during menstruation",
            type="article",
            url="https://www.healthline.com/health/home-remedies-for-menstrual-cramps",
            thumbnail="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400",
            phase="Menstrual"
        ),
        Resource(
            title="Comfort Food Recipes She'll Love",
            description="Easy, cozy meals perfect for period week",
            type="article",
            url="https://www.delish.com/cooking/recipe-ideas/g3733/comfort-food-recipes/",
            thumbnail="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400",
            phase="Menstrual"
        ),
        # Follicular Phase Resources
        Resource(
            title="Adventure Date Ideas for Active Couples",
            description="Plan exciting dates during her high-energy phase",
            type="article",
            url="https://www.timeout.com/usa/things-to-do/adventure-date-ideas",
            thumbnail="https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=400",
            phase="Follicular"
        ),
        Resource(
            title="Affordable Weekend Getaway Ideas",
            description="Budget-friendly trips perfect for her follicular phase energy",
            type="article",
            url="https://www.travelchannel.com/interests/budget-travel/articles/cheap-weekend-getaways",
            thumbnail="https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400",
            phase="Follicular"
        ),
        # Ovulation Phase Resources
        Resource(
            title="Planning the Perfect Romantic Evening",
            description="Make the most of ovulation with these date night ideas",
            type="article",
            url="https://www.cosmopolitan.com/sex-love/a36099732/romantic-date-night-ideas/",
            thumbnail="https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=400",
            phase="Ovulation"
        ),
        Resource(
            title="The Art of Attraction: What Women Notice",
            description="Understanding what catches her eye during peak fertility",
            type="video",
            url="https://www.youtube.com/watch?v=example",
            thumbnail="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
            phase="Ovulation"
        ),
        # Early Luteal Phase Resources
        Resource(
            title="Cozy Date Night Ideas at Home",
            description="Perfect for her nesting phase - quality time without going out",
            type="article",
            url="https://www.oprahdaily.com/life/relationships-love/g28272259/at-home-date-night-ideas/",
            thumbnail="https://images.unsplash.com/photo-1509027572446-af8401acfdc3?w=400",
            phase="Early Luteal"
        ),
        Resource(
            title="DIY Home Projects for Couples",
            description="Channel her nesting energy into fun projects together",
            type="article",
            url="https://www.hgtv.com/design/decorating/design-101/easy-diy-projects-for-couples",
            thumbnail="https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400",
            phase="Early Luteal"
        ),
        # PMS Phase Resources
        Resource(
            title="Understanding PMS: A Guy's Guide",
            description="What's actually happening and how to help (without getting killed)",
            type="article",
            url="https://www.menshealth.com/health/a27084442/what-is-pms/",
            thumbnail="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400",
            phase="Late Luteal/PMS"
        ),
        Resource(
            title="Foods That Help with PMS Symptoms",
            description="What to order or cook when she's PMSing",
            type="article",
            url="https://www.health.com/nutrition/pms-foods",
            thumbnail="https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400",
            phase="Late Luteal/PMS"
        )
    ]
    
    for resource in resources:
        res_dict = resource.model_dump()
        res_dict['created_at'] = res_dict['created_at'].isoformat()
        await db.resources.insert_one(res_dict)
    
    return {"message": f"Seeded {len(resources)} resources"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

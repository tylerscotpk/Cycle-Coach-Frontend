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
    cycle_start_date: str  # Format: YYYY-MM-DD
    cycle_length: int = 28  # Average cycle length
    preferences: dict = {}  # AI learned preferences
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
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
                "Do the dishes. Like, NOW. Don't wait to be asked.",
                "Get her favorite snacks. Ben & Jerry's never hurt nobody.",
                "Netflix marathon = your best move",
                "No jokes about her being 'emotional' unless you want to die",
                "Heating pad + backrub = you're a goddamn hero",
                "She says she's fine? She's not fine. Bring chocolate."
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
                "Book that fancy restaurant NOW while she's down",
                "She'll actually want to leave the house - capitalize on this",
                "Good time to bring up that thing you've been avoiding",
                "Compliments land HARD right now - use them",
                "Try that new thing in bed she mentioned 3 months ago",
                "She's basically a yes-man right now. Seize the day."
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
                "BRO. This is the sexy time window. Clear your schedule.",
                "She's ovulating = nature's horny button is pressed",
                "Tell her she looks hot. Then tell her again.",
                "Plan something romantic tonight (you know why)",
                "This is when she's most likely to say yes to anything 😏",
                "Whatever you do, DO NOT mess this up with lazy boyfriend energy",
                "Put the phone down. Give her your full attention."
            ]
        }
    elif 17 <= cycle_day <= 23:
        return {
            "phase": "Early Luteal",
            "phase_day": cycle_day - 16,
            "description": "Still good vibes - productive phase",
            "emotional_state": "Calm, focused, nurturing",
            "physical_state": "Energy still good, may start to slow down",
            "tips": [
                "She's in nesting mode - help with home projects",
                "Appreciate her efforts around the house",
                "Good time for quality time at home",
                "She may be more nurturing - lean into it",
                "Keep things steady and predictable"
            ]
        }
    else:  # 24-28
        return {
            "phase": "Late Luteal/PMS",
            "phase_day": cycle_day - 23,
            "description": "Storm's coming - tread carefully soldier",
            "emotional_state": "Irritable, emotional, may snap easily",
            "physical_state": "Bloating, fatigue, possible acne",
            "tips": [
                "This ain't about you - don't take things personally",
                "Give space but stay available",
                "Don't start arguments - you won't win",
                "Comfort food delivery = hero status",
                "'You're right honey' is your new mantra",
                "Keep plans flexible - she may need to cancel"
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
    
    # Create chat session
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"{current_user.id}_{chat_data.partner_id}",
        system_message=f"""You are a relationship coach helping a man understand his partner better. 
        The partner's name is {profile['partner_name']}. 
        Your job is to:
        1. Ask insightful questions about the partner's preferences, habits, and personality
        2. Learn from the answers to build a profile
        3. Give practical, actionable advice with a masculine and humorous tone
        4. Keep it real - no corporate speak, talk like a knowledgeable best friend
        
        Current preferences learned: {profile.get('preferences', {})}
        
        Be witty, direct, and genuinely helpful. Think 'bro science' meets actual relationship wisdom."""
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

# ============ RESOURCES ROUTES ============

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
        Resource(
            title="Understanding the Menstrual Cycle",
            description="A comprehensive guide to the four phases of the menstrual cycle",
            type="article",
            url="https://www.healthline.com/health/womens-health/stages-of-menstrual-cycle",
            thumbnail="https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400"
        ),
        Resource(
            title="How to Support Your Partner During PMS",
            description="Expert advice on being there when she needs you most",
            type="article",
            url="https://www.verywellmind.com/pms-support-partner-5207965",
            thumbnail="https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400"
        ),
        Resource(
            title="The Science of Attraction",
            description="Understanding hormones and attraction throughout the cycle",
            type="video",
            url="https://www.youtube.com/watch?v=example",
            thumbnail="https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=400"
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

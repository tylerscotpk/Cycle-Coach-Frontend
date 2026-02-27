from fastapi import FastAPI, APIRouter, HTTPException, Depends, Cookie, Response, Header, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
import secrets
import string
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
import httpx
import resend
import stripe

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
stripe.api_key = STRIPE_API_KEY

# Resend Configuration
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'info@cyclecoach.net')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

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

# ============ EMAIL/PASSWORD AUTH ROUTES ============

import hashlib

def hash_password(password: str) -> str:
    """Hash password using SHA-256 with salt"""
    salt = os.environ.get('PASSWORD_SALT', 'cyclecoach_default_salt_2024')
    return hashlib.sha256(f"{password}{salt}".encode()).hexdigest()

def generate_reset_token() -> str:
    """Generate a secure reset token"""
    return secrets.token_urlsafe(32)

async def send_welcome_email(email: str):
    """Send welcome email after account creation"""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured - skipping welcome email")
        return False
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [email],
            "subject": "Welcome to Cycle Coach!",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0;">Welcome to Cycle Coach!</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your account has been created</p>
                </div>
                <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p>Thanks for joining Cycle Coach — the relationship performance tool built for men.</p>
                    <p>Next step: <strong>Choose a plan</strong> to unlock your dashboard, AI Wingman, cycle tracking, and all the tools you need to stay in sync.</p>
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="https://cyclecoach.net/pricing" style="display: inline-block; background-color: #0891b2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">Choose Your Plan</a>
                    </div>
                    <p style="color: #64748b; font-size: 13px;">If you have any questions, reply to this email or visit our Contact page.</p>
                </div>
                <div style="text-align: center; margin-top: 20px; color: #64748b; font-size: 12px;">
                    <p>Cycle Coach — Stars &amp; Honey, LLC</p>
                </div>
            </div>
            """
        }
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Welcome email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send welcome email to {email}: {str(e)}")
        return False

async def send_purchase_confirmation_email(email: str, tier: str):
    """Send purchase confirmation email after successful Stripe checkout"""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured - skipping purchase confirmation email")
        return False
    tier_names = {"monthly": "Monthly Training Plan", "quarterly": "Quarter by Quarter", "annual": "Full Season Strategy"}
    tier_name = tier_names.get(tier, tier.title())
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [email],
            "subject": f"You're In! Cycle Coach {tier_name} is Active",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0;">You're All Set!</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">{tier_name} — Now Active</p>
                </div>
                <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p>Your <strong>{tier_name}</strong> subscription is now active. You have full access to everything Cycle Coach offers:</p>
                    <ul style="line-height: 2;">
                        <li>Cycle tracking &amp; phase predictions</li>
                        <li>Phase-based tips &amp; insights</li>
                        <li>Partner Profile</li>
                        <li>AI Wingman — personalized advice 24/7</li>
                        <li>Research-backed resources</li>
                    </ul>
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="https://cyclecoach.net/app" style="display: inline-block; background-color: #0891b2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">Open Your Dashboard</a>
                    </div>
                    <p style="color: #64748b; font-size: 13px;">Manage your subscription anytime from Account Settings inside the app.</p>
                </div>
                <div style="text-align: center; margin-top: 20px; color: #64748b; font-size: 12px;">
                    <p>Cycle Coach — Stars &amp; Honey, LLC</p>
                </div>
            </div>
            """
        }
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Purchase confirmation email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send purchase confirmation email to {email}: {str(e)}")
        return False

class RegisterRequest(BaseModel):
    email: str
    password: str
    confirm_password: str
    phone: Optional[str] = None

class LoginRequest(BaseModel):
    email_or_phone: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@api_router.post("/auth/register")
async def register_user(request: RegisterRequest, response: Response):
    """Register a new user with email and password"""
    try:
        email = request.email.lower().strip()
        
        # Validate email format
        if '@' not in email or '.' not in email:
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Validate password
        if len(request.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        
        if request.password != request.confirm_password:
            raise HTTPException(status_code=400, detail="Passwords do not match")
        
        # Check if user already exists
        existing_user = await db.auth_users.find_one({"email": email})
        if existing_user:
            raise HTTPException(status_code=400, detail="An account with this email already exists")
        
        # Check if phone already exists (if provided)
        if request.phone:
            phone = request.phone.strip()
            existing_phone = await db.auth_users.find_one({"phone": phone})
            if existing_phone:
                raise HTTPException(status_code=400, detail="An account with this phone number already exists")
        
        # Create user
        user_id = str(uuid.uuid4())
        password_hash = hash_password(request.password)
        
        auth_user = {
            "id": user_id,
            "email": email,
            "phone": request.phone.strip() if request.phone else None,
            "password_hash": password_hash,
            "is_active": True,
            "subscription_status": None,  # No subscription yet
            "subscription_id": None,
            "subscription_tier": None,
            "trial_ends_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.auth_users.insert_one(auth_user)
        
        # Create session and log user in
        session_token = secrets.token_urlsafe(32)
        session = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_sessions.insert_one(session)
        
        # Set session cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=30 * 24 * 60 * 60  # 30 days
        )
        
        logger.info(f"New user registered: {email}")
        
        # Send welcome email (fire and forget, don't block registration)
        asyncio.create_task(send_welcome_email(email))
        
        return {
            "success": True,
            "message": "Account created successfully",
            "user": {
                "id": user_id,
                "email": email,
                "has_subscription": False
            },
            "session_token": session_token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create account")

@api_router.post("/auth/login")
async def login_user(request: LoginRequest, response: Response):
    """Login with email/phone and password"""
    try:
        identifier = request.email_or_phone.lower().strip()
        
        # Find user by email or phone
        user = await db.auth_users.find_one({
            "$or": [
                {"email": identifier},
                {"phone": identifier}
            ]
        })
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email/phone or password")
        
        # Verify password
        password_hash = hash_password(request.password)
        if user.get("password_hash") != password_hash:
            raise HTTPException(status_code=401, detail="Invalid email/phone or password")
        
        # Check if account is active
        if not user.get("is_active", True):
            raise HTTPException(status_code=401, detail="Account is disabled")
        
        # Create new session
        session_token = secrets.token_urlsafe(32)
        session = {
            "user_id": user["id"],
            "session_token": session_token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_sessions.insert_one(session)
        
        # Set session cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=30 * 24 * 60 * 60  # 30 days
        )
        
        # Check subscription status
        has_subscription = False
        subscription_status = user.get("subscription_status")
        trial_ends_at = user.get("trial_ends_at")
        
        if subscription_status == "active":
            has_subscription = True
        elif trial_ends_at:
            trial_end = datetime.fromisoformat(trial_ends_at.replace('Z', '+00:00')) if isinstance(trial_ends_at, str) else trial_ends_at
            if trial_end > datetime.now(timezone.utc):
                has_subscription = True
        
        logger.info(f"User logged in: {user.get('email')}")
        
        return {
            "success": True,
            "message": "Login successful",
            "user": {
                "id": user["id"],
                "email": user.get("email"),
                "has_subscription": has_subscription,
                "subscription_status": subscription_status,
                "subscription_tier": user.get("subscription_tier")
            },
            "session_token": session_token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail="Login failed")

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Send password reset email"""
    try:
        email = request.email.lower().strip()
        
        # Find user
        user = await db.auth_users.find_one({"email": email})
        
        # Always return success to prevent email enumeration
        if not user:
            return {"success": True, "message": "If an account exists, a reset link has been sent"}
        
        # Generate reset token
        reset_token = generate_reset_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        
        # Store reset token
        await db.password_resets.delete_many({"user_id": user["id"]})  # Remove old tokens
        await db.password_resets.insert_one({
            "user_id": user["id"],
            "email": email,
            "token": reset_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Send reset email
        if RESEND_API_KEY:
            try:
                frontend_url = os.environ.get('FRONTEND_URL', 'https://cyclecoach.net')
                reset_link = f"{frontend_url}/reset-password?token={reset_token}"
                
                resend.Emails.send({
                    "from": SENDER_EMAIL,
                    "to": email,
                    "subject": "Reset Your Cycle Coach Password",
                    "html": f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #0891b2;">Reset Your Password</h2>
                        <p>You requested to reset your Cycle Coach password.</p>
                        <p>Click the button below to set a new password:</p>
                        <a href="{reset_link}" style="display: inline-block; background-color: #0891b2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reset Password</a>
                        <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
                        <p style="color: #666; font-size: 14px;">If you didn't request this, you can ignore this email.</p>
                    </div>
                    """
                })
                logger.info(f"Password reset email sent to: {email}")
            except Exception as e:
                logger.error(f"Failed to send reset email: {str(e)}")
        
        return {"success": True, "message": "If an account exists, a reset link has been sent"}
        
    except Exception as e:
        logger.error(f"Forgot password error: {str(e)}")
        return {"success": True, "message": "If an account exists, a reset link has been sent"}

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password using token"""
    try:
        # Find reset token
        reset_record = await db.password_resets.find_one({"token": request.token})
        
        if not reset_record:
            raise HTTPException(status_code=400, detail="Invalid or expired reset link")
        
        # Check if expired
        expires_at = datetime.fromisoformat(reset_record["expires_at"].replace('Z', '+00:00'))
        if expires_at < datetime.now(timezone.utc):
            await db.password_resets.delete_one({"token": request.token})
            raise HTTPException(status_code=400, detail="Reset link has expired")
        
        # Validate new password
        if len(request.new_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        
        # Update password
        password_hash = hash_password(request.new_password)
        await db.auth_users.update_one(
            {"id": reset_record["user_id"]},
            {"$set": {"password_hash": password_hash, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Delete used token
        await db.password_resets.delete_one({"token": request.token})
        
        # Invalidate all existing sessions
        await db.user_sessions.delete_many({"user_id": reset_record["user_id"]})
        
        logger.info(f"Password reset for user: {reset_record['email']}")
        
        return {"success": True, "message": "Password reset successfully. Please log in with your new password."}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset password error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to reset password")

@api_router.get("/auth/check")
async def check_auth(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    """Check if user is authenticated and get subscription status"""
    try:
        token = session_token
        if not token and authorization and authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
        
        if not token:
            return {"authenticated": False, "has_subscription": False}
        
        # Find session
        session = await db.user_sessions.find_one({"session_token": token})
        if not session:
            return {"authenticated": False, "has_subscription": False}
        
        # Check if expired
        expires_at = session.get('expires_at')
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        if expires_at < datetime.now(timezone.utc):
            return {"authenticated": False, "has_subscription": False}
        
        # Get user
        user = await db.auth_users.find_one({"id": session["user_id"]})
        if not user:
            return {"authenticated": False, "has_subscription": False}
        
        # Check subscription status
        has_subscription = False
        subscription_status = user.get("subscription_status")
        trial_ends_at = user.get("trial_ends_at")
        
        if subscription_status in ("active", "cancelling"):
            has_subscription = True
        elif trial_ends_at:
            try:
                trial_end = datetime.fromisoformat(trial_ends_at.replace('Z', '+00:00')) if isinstance(trial_ends_at, str) else trial_ends_at
                if trial_end > datetime.now(timezone.utc):
                    has_subscription = True
            except Exception:
                pass
        
        return {
            "authenticated": True,
            "has_subscription": has_subscription,
            "user": {
                "id": user["id"],
                "email": user.get("email"),
                "subscription_status": subscription_status,
                "subscription_tier": user.get("subscription_tier"),
                "stripe_subscription_id": user.get("stripe_subscription_id"),
                "cancels_at": user.get("cancels_at")
            }
        }
        
    except Exception as e:
        logger.error(f"Auth check error: {str(e)}")
        return {"authenticated": False, "has_subscription": False}

@api_router.get("/account/subscription")
async def get_account_subscription(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    """Get detailed subscription info for account settings page"""
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user = await db.auth_users.find_one({"id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "email": user.get("email"),
        "subscription_status": user.get("subscription_status"),
        "subscription_tier": user.get("subscription_tier"),
        "stripe_subscription_id": user.get("stripe_subscription_id"),
        "cancels_at": user.get("cancels_at"),
        "created_at": user.get("created_at"),
    }

@api_router.post("/account/cancel-subscription")
async def cancel_user_subscription(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    """Cancel the authenticated user's subscription"""
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user = await db.auth_users.find_one({"id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription_id = user.get("stripe_subscription_id")
    if not subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription found")
    
    if user.get("subscription_status") == "cancelling":
        raise HTTPException(status_code=400, detail="Subscription is already scheduled for cancellation")
    
    try:
        updated_subscription = stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True
        )
        
        cancel_at = updated_subscription.current_period_end
        cancels_at_date = datetime.fromtimestamp(cancel_at, tz=timezone.utc).isoformat()
        
        # Update auth_users
        await db.auth_users.update_one(
            {"id": session["user_id"]},
            {"$set": {
                "subscription_status": "cancelling",
                "cancels_at": cancels_at_date,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Also update license_keys for backward compat
        await db.license_keys.update_one(
            {"stripe_subscription_id": subscription_id},
            {"$set": {
                "cancels_at": cancels_at_date,
                "is_cancelled": True,
                "cancelled_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"User {user.get('email')} cancelled subscription {subscription_id}")
        
        return {
            "success": True,
            "message": "Subscription cancelled successfully",
            "cancels_at": cancels_at_date
        }
    except stripe.StripeError as e:
        logger.error(f"Stripe error cancelling subscription: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to cancel: {str(e)}")

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
    
    # Recalculate all cycle lengths and statuses
    await recalculate_cycle_lengths(partner_id)
    
    # Update partner profile with most recent cycle info
    await update_partner_cycle_info(partner_id)
    
    # Get updated average
    updated_profile = await db.partner_profiles.find_one(
        {"id": partner_id},
        {"_id": 0}
    )
    avg_length = updated_profile.get('average_cycle_length', 28)
    
    return {
        "message": "Period logged successfully",
        "new_cycle_start": start_date,
        "previous_cycle_length": cycle_length,
        "average_cycle_length": avg_length
    }

@api_router.delete("/cycle/history/{cycle_id}")
async def delete_cycle_entry(
    cycle_id: str,
    partner_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a cycle history entry and recalculate"""
    # Verify ownership
    profile = await db.partner_profiles.find_one(
        {"id": partner_id, "user_id": current_user.id},
        {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Partner profile not found")
    
    # Delete the entry
    result = await db.cycle_history.delete_one({"id": cycle_id, "partner_id": partner_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cycle entry not found")
    
    # Recalculate all cycle lengths
    await recalculate_cycle_lengths(partner_id)
    
    # Update partner profile with most recent cycle start and new average
    await update_partner_cycle_info(partner_id)
    
    return {"message": "Cycle entry deleted and data recalculated"}

@api_router.post("/cycle/backfill")
async def backfill_periods(
    partner_id: str,
    period_dates: List[str],  # List of dates in YYYY-MM-DD format
    current_user: User = Depends(get_current_user)
):
    """Add multiple historical period dates at once"""
    profile = await db.partner_profiles.find_one(
        {"id": partner_id, "user_id": current_user.id},
        {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Partner profile not found")
    
    # Sort dates chronologically
    sorted_dates = sorted(period_dates)
    
    # Check for duplicates in existing history
    existing = await db.cycle_history.find(
        {"partner_id": partner_id},
        {"_id": 0, "cycle_start_date": 1}
    ).to_list(100)
    existing_dates = {e['cycle_start_date'] for e in existing}
    
    # Add new entries
    added = 0
    for date_str in sorted_dates:
        if date_str not in existing_dates:
            new_cycle = CycleHistory(
                partner_id=partner_id,
                cycle_start_date=date_str,
                cycle_length=None
            )
            cycle_dict = new_cycle.model_dump()
            cycle_dict['created_at'] = cycle_dict['created_at'].isoformat()
            await db.cycle_history.insert_one(cycle_dict)
            added += 1
    
    # Recalculate all cycle lengths
    await recalculate_cycle_lengths(partner_id)
    
    # Update partner profile
    await update_partner_cycle_info(partner_id)
    
    return {
        "message": f"Added {added} historical periods",
        "total_cycles": added + len(existing)
    }

async def recalculate_cycle_lengths(partner_id: str):
    """Recalculate cycle lengths for all entries"""
    def parse_date(date_str):
        """Parse date from multiple formats"""
        for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"]:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Cannot parse date: {date_str}")
    
    # Get all cycles
    cycles = await db.cycle_history.find(
        {"partner_id": partner_id},
        {"_id": 0}
    ).to_list(100)
    
    # Sort cycles by parsed date and remove duplicates (same date)
    cycles_with_dates = [(parse_date(c['cycle_start_date']), c) for c in cycles]
    cycles_with_dates.sort(key=lambda x: x[0])
    
    # Remove duplicates - keep the first occurrence of each date
    seen_dates = set()
    unique_cycles = []
    for date, cycle in cycles_with_dates:
        if date not in seen_dates:
            seen_dates.add(date)
            unique_cycles.append((date, cycle))
        else:
            # Delete duplicate entry
            await db.cycle_history.delete_one({"id": cycle['id']})
    
    sorted_cycles = [c for _, c in unique_cycles]
    
    # Calculate length for each cycle (except the last/current one)
    for i in range(len(sorted_cycles) - 1):
        current_date, _ = unique_cycles[i]
        next_date, _ = unique_cycles[i + 1]
        cycle_length = (next_date - current_date).days
        
        await db.cycle_history.update_one(
            {"id": sorted_cycles[i]['id']},
            {"$set": {
                "cycle_length": cycle_length,
                "status": "completed"
            }}
        )
    
    # Last cycle is current (no length)
    if sorted_cycles:
        await db.cycle_history.update_one(
            {"id": sorted_cycles[-1]['id']},
            {"$set": {
                "cycle_length": None,
                "status": "current"
            }}
        )

async def update_partner_cycle_info(partner_id: str):
    """Update partner profile with most recent cycle and calculated average"""
    # Get all cycles to find the most recent
    all_cycles = await db.cycle_history.find(
        {"partner_id": partner_id},
        {"_id": 0}
    ).to_list(100)
    
    if not all_cycles:
        return
    
    # Parse dates and sort to find most recent
    def parse_date(date_str):
        for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"]:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        return datetime.now().date()
    
    all_cycles.sort(key=lambda x: parse_date(x['cycle_start_date']), reverse=True)
    recent_cycle = all_cycles[0]
    
    # Calculate average from completed cycles (those with cycle_length)
    completed = [c for c in all_cycles if c.get('cycle_length') and c['cycle_length'] > 0][:6]
    
    if completed:
        avg_length = sum(c['cycle_length'] for c in completed) // len(completed)
    else:
        avg_length = 28
    
    await db.partner_profiles.update_one(
        {"id": partner_id},
        {"$set": {
            "cycle_start_date": recent_cycle['cycle_start_date'],
            "average_cycle_length": avg_length,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

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
    
    # Recalculate cycle lengths to ensure data is current
    await recalculate_cycle_lengths(partner_id)
    
    # Get cycle history (last 12 cycles) - sorted in descending order
    history = await db.cycle_history.find(
        {"partner_id": partner_id},
        {"_id": 0}
    ).to_list(100)
    
    # Sort by parsed date (most recent first)
    def parse_date(date_str):
        for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"]:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        return datetime.now().date()
    
    history.sort(key=lambda x: parse_date(x['cycle_start_date']), reverse=True)
    history = history[:12]  # Limit to 12 most recent
    
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
    
    # Predict next period based on MOST RECENT cycle start
    if history:
        # Get the most recent cycle start date
        most_recent_date_str = history[0]['cycle_start_date']  # Already sorted by date descending
        def parse_date_simple(date_str):
            for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"]:
                try:
                    return datetime.strptime(date_str, fmt).date()
                except ValueError:
                    continue
            return datetime.now().date()
        
        current_start = parse_date_simple(most_recent_date_str)
        predicted_next = current_start + timedelta(days=avg_length)
        days_until = (predicted_next - datetime.now(timezone.utc).date()).days
    else:
        # Fallback if no history
        current_start = datetime.now(timezone.utc).date()
        predicted_next = current_start + timedelta(days=avg_length)
        days_until = avg_length
    
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
            "days_until_next": days_until
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
    cycle_length = profile.get('average_cycle_length') or profile.get('cycle_length', 28)
    if cycle_length == 0:
        cycle_length = 28
    cycle_day = (days_since_start % cycle_length) + 1
    
    # Determine phase
    phase_info = get_phase_info(cycle_day)
    
    return {
        "cycle_day": cycle_day,
        "phase": phase_info['phase'],
        "phase_number": phase_info['phase_number'],
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
            "phase_number": 1,
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
            "phase_number": 2,
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
            "phase_number": 3,
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
            "phase_number": 4,
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
            "phase_number": 5,
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
    cycle_length = profile.get('average_cycle_length') or profile.get('cycle_length', 28)
    if cycle_length == 0:
        cycle_length = 28
    current_cycle_day = (days_since_start % cycle_length) + 1
    profile['current_cycle_day'] = current_cycle_day
    
    # Get current phase info for context
    phase_info = get_phase_info(current_cycle_day)
    
    # PRIVACY: Generate anonymous session ID (hash user+partner IDs)
    import hashlib
    anonymous_session = hashlib.sha256(f"{current_user.id}_{chat_data.partner_id}".encode()).hexdigest()[:16]
    
    # PRIVACY: Do NOT send partner name to AI - use generic term
    # PRIVACY: Do NOT send any identifying information
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"anon_{anonymous_session}",
        system_message=f"""You're the ultimate relationship wingman - like texting your wise older bro at 2am.

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
            cycle_length = profile.get('average_cycle_length') or profile.get('cycle_length', 28)
            if cycle_length == 0:
                cycle_length = 28
            cycle_day = (days_since_start % cycle_length) + 1
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
    cycle_length = profile.get('average_cycle_length') or profile.get('cycle_length', 28)
    if cycle_length == 0:
        cycle_length = 28
    cycle_day = (days_since_start % cycle_length) + 1
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

# ============================================
# LICENSE KEY & STRIPE WEBHOOK (Monetization)
# ============================================

def generate_license_key():
    """Generate a unique license key in format: CC-XXXX-XXXX-XXXX"""
    chars = string.ascii_uppercase + string.digits
    segments = [''.join(secrets.choice(chars) for _ in range(4)) for _ in range(3)]
    return f"CC-{'-'.join(segments)}"

class LicenseKey(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    license_key: str
    customer_email: str
    stripe_session_id: str
    stripe_payment_intent: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LicenseValidationRequest(BaseModel):
    license_key: str

class LicenseValidationResponse(BaseModel):
    valid: bool
    message: str

async def send_license_email(customer_email: str, license_key: str):
    """Send license key to customer via Resend"""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured - skipping email")
        return False
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }}
            .license-box {{ background: #1e293b; color: #22d3ee; padding: 20px; border-radius: 8px; text-align: center; font-family: monospace; font-size: 24px; letter-spacing: 2px; margin: 20px 0; }}
            .instructions {{ background: white; padding: 20px; border-radius: 8px; margin-top: 20px; }}
            .footer {{ text-align: center; margin-top: 20px; color: #64748b; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">🎉 Welcome to Cycle Coach!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your purchase is complete</p>
            </div>
            <div class="content">
                <p>Thanks for your purchase! Here's your license key to unlock Cycle Coach:</p>
                
                <div class="license-box">
                    {license_key}
                </div>
                
                <div class="instructions">
                    <h3 style="margin-top: 0;">How to activate:</h3>
                    <ol>
                        <li>Open the Cycle Coach app</li>
                        <li>Enter your license key in the activation field</li>
                        <li>Click "Activate License"</li>
                        <li>Start tracking!</li>
                    </ol>
                </div>
                
                <p style="margin-top: 20px;"><strong>Keep this email safe!</strong> Your license key grants lifetime access to Cycle Coach.</p>
            </div>
            <div class="footer">
                <p>Cycle Coach - Your relationship game-changer</p>
                <p>Questions? Reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [customer_email],
            "subject": "🔑 Your Cycle Coach License Key",
            "html": html_content
        }
        
        # Run sync SDK in thread to keep FastAPI non-blocking
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"License email sent to {customer_email}, email_id: {email_result.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send license email: {str(e)}")
        return False

# ============================================
# STRIPE SUBSCRIPTION ENDPOINTS
# ============================================

class CreateCheckoutRequest(BaseModel):
    email: str
    tier: str  # 'basic' or 'premium'
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None

@api_router.post("/subscription/create-checkout")
async def create_checkout_session(request: CreateCheckoutRequest):
    """Create a Stripe Checkout session for subscription"""
    email = request.email.lower().strip()
    tier = request.tier.lower()
    
    if tier not in ['basic', 'premium']:
        raise HTTPException(status_code=400, detail="Invalid tier. Must be 'basic' or 'premium'")
    
    # Set pricing
    price_cents = SUBSCRIPTION_TIERS[tier]["price_cents"]
    tier_name = SUBSCRIPTION_TIERS[tier]["name"]
    
    try:
        # Create Stripe checkout session with subscription mode
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'unit_amount': price_cents,
                    'recurring': {
                        'interval': 'month'
                    },
                    'product_data': {
                        'name': f'Cycle Coach {tier_name}',
                        'description': f'Monthly subscription to Cycle Coach {tier_name}',
                    },
                },
                'quantity': 1,
            }],
            mode='subscription',
            customer_email=email,
            success_url=request.success_url or f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}?subscription=success&tier={tier}",
            cancel_url=request.cancel_url or f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}?subscription=cancelled",
            metadata={
                'tier': tier,
                'customer_email': email
            }
        )
        
        logger.info(f"Created checkout session {checkout_session.id} for {email} ({tier})")
        
        return {
            "status": "success",
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id
        }
    except Exception as e:
        logger.error(f"Error creating checkout session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout: {str(e)}")

async def send_subscription_email(customer_email: str, license_key: str, tier: str):
    """Send subscription confirmation email with license key"""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured - skipping email")
        return False
    
    tier_config = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS.get("monthly", {}))
    tier_name = tier_config["name"]
    has_ai = tier_config["has_ai_wingman"]
    has_profile = tier_config["has_partner_profile"]
    
    features_html = """
        <li>✅ Cycle tracking & phase predictions</li>
        <li>✅ Research-backed insights & tips</li>
        <li>✅ Educational resources</li>
    """
    if has_profile:
        features_html += "<li>✅ Partner Profile - save all her preferences</li>"
    if has_ai:
        features_html += "<li>✅ AI Wingman - personalized advice 24/7</li>"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }}
            .license-box {{ background: #1e293b; color: #22d3ee; padding: 20px; border-radius: 8px; text-align: center; font-family: monospace; font-size: 24px; letter-spacing: 2px; margin: 20px 0; }}
            .tier-badge {{ background: {'#8b5cf6' if tier == 'premium' else '#06b6d4'}; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 15px; }}
            .instructions {{ background: white; padding: 20px; border-radius: 8px; margin-top: 20px; }}
            .footer {{ text-align: center; margin-top: 20px; color: #64748b; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">🎉 Welcome to Cycle Coach {tier_name}!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your subscription is now active</p>
            </div>
            <div class="content">
                <div style="text-align: center;">
                    <span class="tier-badge">⭐ {tier_name} Plan</span>
                </div>
                
                <p>Thank you for subscribing! Here's your license key:</p>
                
                <div class="license-box">
                    {license_key}
                </div>
                
                <div class="instructions">
                    <h3 style="margin-top: 0;">Your {tier_name} features:</h3>
                    <ul>
                        {features_html}
                    </ul>
                </div>
                
                <p style="margin-top: 20px;"><strong>Keep this email safe!</strong> Use this license key to access Cycle Coach.</p>
            </div>
            <div class="footer">
                <p>Cycle Coach - Your relationship game-changer</p>
                <p>Questions? Reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [customer_email],
            "subject": f"🔑 Your Cycle Coach {tier_name} License Key",
            "html": html_content
        }
        
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Subscription email sent to {customer_email}, email_id: {email_result.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send subscription email: {str(e)}")
        return False

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events for subscriptions"""
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature")
    
    try:
        # Verify webhook signature if secret is configured
        if STRIPE_WEBHOOK_SECRET and sig_header:
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET
            )
        else:
            # For testing without webhook secret
            import json
            event = json.loads(payload)
            logger.warning("Processing webhook without signature verification")
        
        event_type = event.get("type") if isinstance(event, dict) else event.type
        logger.info(f"Received Stripe webhook: {event_type}")
        
        # Handle checkout.session.completed event (subscription created)
        if event_type == "checkout.session.completed":
            session = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
            
            customer_email = session.get("customer_email") or session.get("customer_details", {}).get("email")
            session_id = session.get("id")
            subscription_id = session.get("subscription")
            metadata = session.get("metadata", {})
            tier = metadata.get("tier", "monthly")
            
            if not customer_email:
                logger.error(f"No customer email in session {session_id}")
                return {"status": "error", "message": "No customer email"}
            
            customer_email = customer_email.lower().strip()
            
            # Only update existing auth_users — do NOT create ghost records
            auth_user = await db.auth_users.find_one({"email": customer_email})
            if auth_user:
                # Check if already processed
                if auth_user.get("stripe_subscription_id") == subscription_id:
                    logger.info(f"Subscription already synced for {customer_email}")
                    return {"status": "already_processed"}
                
                await db.auth_users.update_one(
                    {"email": customer_email},
                    {"$set": {
                        "subscription_status": "active",
                        "subscription_tier": tier,
                        "stripe_subscription_id": subscription_id,
                        "stripe_session_id": session_id,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                logger.info(f"Activated {tier} subscription for {customer_email}")
                
                # Send purchase confirmation email
                asyncio.create_task(send_purchase_confirmation_email(customer_email, tier))
                
                return {"status": "success", "tier": tier}
            else:
                # No registered user — log warning, do NOT create ghost record
                logger.warning(f"Webhook: No registered user found for {customer_email} (session {session_id}). Skipping — user must register first.")
                return {"status": "no_user", "message": f"No registered user for {customer_email}"}
        
        # Handle subscription cancelled
        elif event_type == "customer.subscription.deleted":
            subscription = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
            subscription_id = subscription.get("id")
            
            # Deactivate the license
            result = await db.license_keys.update_one(
                {"stripe_subscription_id": subscription_id},
                {"$set": {"is_active": False, "is_cancelled": True, "cancelled_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            if result.modified_count > 0:
                logger.info(f"Deactivated license for subscription {subscription_id}")
            
            # Sync to auth_users
            await db.auth_users.update_one(
                {"stripe_subscription_id": subscription_id},
                {"$set": {
                    "subscription_status": "cancelled",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            return {"status": "subscription_cancelled"}
        
        # Handle subscription updated (status changes, plan changes, cancellation scheduled)
        elif event_type == "customer.subscription.updated":
            subscription = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
            subscription_id = subscription.get("id")
            status = subscription.get("status")  # active, past_due, canceled, unpaid, etc.
            cancel_at_period_end = subscription.get("cancel_at_period_end", False)
            cancel_at = subscription.get("cancel_at")  # Unix timestamp when subscription will be cancelled
            current_period_end = subscription.get("current_period_end")  # Unix timestamp
            
            update_fields = {
                "subscription_status": status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Handle scheduled cancellation (cancel_at_period_end = true)
            if cancel_at_period_end and cancel_at:
                cancels_at_date = datetime.fromtimestamp(cancel_at, tz=timezone.utc).isoformat()
                update_fields["cancels_at"] = cancels_at_date
                update_fields["is_cancelled"] = True  # Mark as pending cancellation
                logger.info(f"Subscription {subscription_id} scheduled to cancel at {cancels_at_date}")
            elif not cancel_at_period_end:
                # Cancellation was reversed or subscription renewed
                update_fields["cancels_at"] = None
                update_fields["is_cancelled"] = False
            
            # Update expiration based on current period end
            if current_period_end:
                expires_at_date = datetime.fromtimestamp(current_period_end, tz=timezone.utc).isoformat()
                update_fields["expires_at"] = expires_at_date
            
            # Handle status changes
            if status == "active":
                update_fields["is_active"] = True
                update_fields["payment_status"] = "current"
            elif status == "past_due":
                update_fields["payment_status"] = "past_due"
            elif status == "unpaid":
                update_fields["is_active"] = False
                update_fields["payment_status"] = "unpaid"
            elif status == "canceled":
                update_fields["is_active"] = False
                update_fields["is_cancelled"] = True
            
            result = await db.license_keys.update_one(
                {"stripe_subscription_id": subscription_id},
                {"$set": update_fields}
            )
            
            if result.modified_count > 0:
                logger.info(f"Updated subscription {subscription_id}: status={status}, cancel_at_period_end={cancel_at_period_end}")
            
            # Sync key fields to auth_users
            auth_update = {"updated_at": datetime.now(timezone.utc).isoformat()}
            if status == "active":
                auth_update["subscription_status"] = "active"
            elif status in ("canceled", "unpaid"):
                auth_update["subscription_status"] = "cancelled"
            elif status == "past_due":
                auth_update["subscription_status"] = "past_due"
            
            await db.auth_users.update_one(
                {"stripe_subscription_id": subscription_id},
                {"$set": auth_update}
            )
            
            return {"status": "subscription_updated", "subscription_status": status}
        
        # Handle payment failed
        elif event_type == "invoice.payment_failed":
            invoice = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
            subscription_id = invoice.get("subscription")
            
            logger.warning(f"Payment failed for subscription {subscription_id}")
            
            # Optionally deactivate or mark as past_due
            await db.license_keys.update_one(
                {"stripe_subscription_id": subscription_id},
                {"$set": {"payment_status": "past_due"}}
            )
            
            # Sync to auth_users
            await db.auth_users.update_one(
                {"stripe_subscription_id": subscription_id},
                {"$set": {"subscription_status": "past_due", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            return {"status": "payment_failed_recorded"}
        
        return {"status": "ignored", "event_type": event_type}
        
    except stripe.SignatureVerificationError as e:
        logger.error(f"Webhook signature verification failed: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# CANCEL SUBSCRIPTION ENDPOINT
# ============================================

class CancelSubscriptionRequest(BaseModel):
    customerId: str
    subscriptionId: str

@api_router.post("/cancel-subscription")
async def cancel_subscription(request: CancelSubscriptionRequest):
    """Cancel a user's subscription at the end of the billing period"""
    try:
        customer_id = request.customerId
        subscription_id = request.subscriptionId
        
        logger.info(f"Cancel subscription request: customer={customer_id}, subscription={subscription_id}")
        
        # Verify the subscription exists in our database
        license_record = await db.license_keys.find_one(
            {
                "stripe_subscription_id": subscription_id,
                "stripe_customer_id": customer_id,
                "is_active": True
            },
            {"_id": 0}
        )
        
        if not license_record:
            logger.warning(f"No active license found for subscription {subscription_id}")
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": "Subscription not found or already cancelled"}
            )
        
        # Check if already cancelled
        if license_record.get("is_cancelled") and license_record.get("cancels_at"):
            return JSONResponse(
                status_code=400,
                content={
                    "success": False, 
                    "message": "Subscription is already scheduled for cancellation",
                    "cancels_at": license_record.get("cancels_at")
                }
            )
        
        # Cancel the subscription at period end using Stripe API
        try:
            updated_subscription = stripe.Subscription.modify(
                subscription_id,
                cancel_at_period_end=True
            )
            
            # Get the cancellation date
            cancel_at = updated_subscription.current_period_end
            cancels_at_date = datetime.fromtimestamp(cancel_at, tz=timezone.utc).isoformat()
            
            # Update our database
            await db.license_keys.update_one(
                {"stripe_subscription_id": subscription_id},
                {
                    "$set": {
                        "cancels_at": cancels_at_date,
                        "is_cancelled": True,
                        "cancelled_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            # Sync cancellation to auth_users
            await db.auth_users.update_one(
                {"stripe_subscription_id": subscription_id},
                {"$set": {
                    "subscription_status": "cancelling",
                    "cancels_at": cancels_at_date,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            logger.info(f"Successfully cancelled subscription {subscription_id}, cancels at {cancels_at_date}")
            
            return {
                "success": True,
                "message": "Subscription cancelled successfully",
                "cancels_at": cancels_at_date
            }
            
        except stripe.StripeError as e:
            logger.error(f"Stripe error cancelling subscription: {str(e)}")
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": f"Failed to cancel subscription: {str(e)}"}
            )
            
    except Exception as e:
        logger.error(f"Error cancelling subscription: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "An error occurred while cancelling your subscription"}
        )

class LicenseValidationResponseExtended(BaseModel):
    valid: bool
    message: str
    tier: Optional[str] = None
    has_partner_profile: Optional[bool] = None
    has_ai_wingman: Optional[bool] = None
    expires_at: Optional[str] = None
    email: Optional[str] = None

@api_router.post("/license/validate")
async def validate_license(request: LicenseValidationRequest):
    """Validate a license key and return tier info"""
    normalized_key = request.license_key.strip().upper()
    
    # Check database for license
    license_record = await db.license_keys.find_one(
        {"license_key": normalized_key, "is_active": True, "is_cancelled": {"$ne": True}},
        {"_id": 0}
    )
    
    if license_record:
        # Check if expired
        expires_at = license_record.get("expires_at")
        if expires_at:
            expiry_date = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            if datetime.now(timezone.utc) > expiry_date:
                return {
                    "valid": False,
                    "message": "Your subscription has expired. Please choose a plan to continue."
                }
        
        # Check if already activated (allow re-activation for same device/returning users)
        activation_count = license_record.get("activation_count", 0)
        
        # First-time activation - mark as activated
        if activation_count == 0:
            await db.license_keys.update_one(
                {"license_key": normalized_key},
                {
                    "$set": {"activation_count": 1, "activated_at": datetime.now(timezone.utc).isoformat()},
                }
            )
        
        # Determine tier and features
        key_type = license_record.get("key_type", "monthly")
        subscription_tier = license_record.get("subscription_tier", key_type)
        is_trial = license_record.get("is_trial", False)
        
        # Get trial start date for feedback prompts
        created_at = license_record.get("created_at")
        
        # All new plans have full access (Partner Profile + AI Wingman)
        # Grandfathered users: existing lifetime/yearly keys get full access
        if key_type in ["lifetime", "yearly"] or subscription_tier == "grandfathered":
            tier = "grandfathered"
            tier_display = "Lifetime Access"
            has_partner_profile = True
            has_ai_wingman = True
        elif subscription_tier == "annual" or key_type == "annual":
            tier = "annual"
            tier_display = "Full Season Strategy"
            has_partner_profile = True
            has_ai_wingman = True
        elif subscription_tier == "quarterly" or key_type == "quarterly":
            tier = "quarterly"
            tier_display = "Quarter by Quarter"
            has_partner_profile = True
            has_ai_wingman = True
        elif subscription_tier == "monthly" or key_type == "monthly":
            tier = "monthly"
            tier_display = "Monthly Training Plan"
            has_partner_profile = True
            has_ai_wingman = True
        else:
            # Legacy tiers - all get full access now
            tier = subscription_tier or key_type or "monthly"
            tier_display = SUBSCRIPTION_TIERS.get(tier, {}).get("display_name", "Cycle Coach")
            has_partner_profile = True
            has_ai_wingman = True
        
        return {
            "valid": True,
            "message": "License key is valid",
            "tier": tier,
            "tier_display": tier_display,
            "has_partner_profile": has_partner_profile,
            "has_ai_wingman": has_ai_wingman,
            "expires_at": expires_at,
            "email": license_record.get("customer_email"),
            "is_trial": is_trial,
            "created_at": created_at
        }
    
    # Also check hardcoded keys for backward compatibility (grandfathered with full access)
    hardcoded_keys = [
        'CYCLE-COACH-2024-ALPHA',
        'CYCLE-COACH-2024-BETA',
        'CYCLE-COACH-LAUNCH-001',
        'CYCLE-COACH-LAUNCH-002',
        'CYCLE-COACH-LAUNCH-003',
        'CC-EARLY-ACCESS-001',
        'CC-EARLY-ACCESS-002',
        'CC-FOUNDER-SPECIAL'
    ]
    
    if normalized_key in hardcoded_keys:
        return {
            "valid": True,
            "message": "License key is valid",
            "tier": "grandfathered",
            "tier_display": "Lifetime Access",
            "has_partner_profile": True,
            "has_ai_wingman": True,
            "expires_at": None,
            "email": None,
            "is_trial": False
        }
    
    return {
        "valid": False,
        "message": "Invalid license key"
    }

@api_router.get("/subscription/tiers")
async def get_subscription_tiers():
    """Get available subscription tiers and pricing (cached in frontend, minimal API calls)"""
    return {
        "tiers": [
            {
                "id": "monthly",
                "name": "Monthly Training Plan",
                "price": 3.99,
                "price_display": "$3.99/month",
                "billing": "Monthly",
                "has_trial": True,
                "trial_days": 7,
                "description": "Start strong with guided training and personalized insights. Free 7-day trial.",
                "features": [
                    "Cycle tracking & predictions",
                    "Research-backed insights",
                    "Educational resources",
                    "Partner Profile",
                    "AI Wingman"
                ],
                "has_partner_profile": True,
                "has_ai_wingman": True,
                "badge": "7-DAY FREE TRIAL"
            },
            {
                "id": "quarterly",
                "name": "Quarter by Quarter",
                "price": 10.49,
                "price_display": "$10.49/3 months",
                "billing": "Every 3 months",
                "has_trial": False,
                "description": "Stay consistent with a 90-day cycle designed for real relationship progress. Save compared to monthly.",
                "features": [
                    "Cycle tracking & predictions",
                    "Research-backed insights",
                    "Educational resources",
                    "Partner Profile",
                    "AI Wingman"
                ],
                "has_partner_profile": True,
                "has_ai_wingman": True,
                "badge": "SAVE 12%"
            },
            {
                "id": "annual",
                "name": "Full Season Strategy",
                "price": 35.91,
                "price_display": "$35.91/year",
                "billing": "Annual",
                "has_trial": False,
                "description": "Commit to long-term growth. Best value — includes 3 free months compared to monthly.",
                "features": [
                    "Cycle tracking & predictions",
                    "Research-backed insights",
                    "Educational resources",
                    "Partner Profile",
                    "AI Wingman"
                ],
                "has_partner_profile": True,
                "has_ai_wingman": True,
                "badge": "BEST VALUE",
                "recommended": True
            }
        ]
    }

class UpgradeRequest(BaseModel):
    email: str
    current_license_key: str
    new_tier: str  # 'winning' or 'elite'

@api_router.post("/subscription/upgrade")
async def create_upgrade_checkout(request: UpgradeRequest):
    """Create checkout session to upgrade from current tier"""
    email = request.email.lower().strip()
    new_tier = request.new_tier.lower()
    
    if new_tier not in ['winning', 'elite']:
        raise HTTPException(status_code=400, detail="Invalid tier. Must be 'winning' or 'elite'")
    
    # Verify current license exists
    current_license = await db.license_keys.find_one(
        {"customer_email": email, "is_active": True, "is_cancelled": {"$ne": True}},
        {"_id": 0}
    )
    
    if not current_license:
        raise HTTPException(status_code=404, detail="No active license found")
    
    current_tier = current_license.get("subscription_tier", current_license.get("key_type", "free_training"))
    
    # Validate upgrade path
    tier_order = {"free_training": 0, "winning": 1, "elite": 2, "grandfathered": 3, "lifetime": 3, "yearly": 2}
    if tier_order.get(new_tier, 0) <= tier_order.get(current_tier, 0):
        raise HTTPException(status_code=400, detail=f"Cannot upgrade from {current_tier} to {new_tier}")
    
    # Create checkout session
    price_cents = SUBSCRIPTION_TIERS[new_tier]["price_cents"]
    tier_name = SUBSCRIPTION_TIERS[new_tier]["name"]
    
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'unit_amount': price_cents,
                    'recurring': {
                        'interval': 'month'
                    },
                    'product_data': {
                        'name': f'Cycle Coach {tier_name}',
                        'description': f'Upgrade to Cycle Coach {tier_name}',
                    },
                },
                'quantity': 1,
            }],
            mode='subscription',
            customer_email=email,
            success_url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}?upgrade=success&tier={new_tier}",
            cancel_url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}?upgrade=cancelled",
            metadata={
                'tier': new_tier,
                'customer_email': email,
                'upgrade_from': current_tier,
                'previous_license_key': request.current_license_key
            }
        )
        
        logger.info(f"Created upgrade checkout session {checkout_session.id} for {email} ({current_tier} -> {new_tier})")
        
        return {
            "status": "success",
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id
        }
    except Exception as e:
        logger.error(f"Error creating upgrade checkout: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout: {str(e)}")

@api_router.get("/license/check/{email}")
async def check_license_by_email(email: str):
    """Check if a license exists for an email (for customer support)"""
    license_record = await db.license_keys.find_one(
        {"customer_email": email.lower()},
        {"_id": 0, "license_key": 1, "created_at": 1, "is_active": 1}
    )
    
    if license_record:
        return {
            "found": True,
            "license_key": license_record.get("license_key"),
            "is_active": license_record.get("is_active", True)
        }
    
    return {"found": False}

class TrialRequestInput(BaseModel):
    email: str

@api_router.post("/license/resend")
async def resend_license_key(request: TrialRequestInput):
    """Resend license key to a user's email"""
    email = request.email.lower().strip()
    
    # Find the most recent active license for this email
    license_record = await db.license_keys.find_one(
        {"customer_email": email, "is_active": True, "is_cancelled": {"$ne": True}},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if not license_record:
        return {
            "status": "not_found",
            "message": "No active license found for this email. Please request a trial or purchase access."
        }
    
    license_key = license_record.get("license_key")
    
    # Send email with license key
    email_sent = await send_license_email(email, license_key)
    
    if email_sent:
        return {
            "status": "success",
            "message": "License key sent! Check your email."
        }
    else:
        return {
            "status": "error",
            "message": "Unable to send email. Please try again or contact support."
        }

# ============================================
# TRIAL ACCESS SYSTEM
# ============================================

class TrialRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    status: str = "pending"  # pending, approved, rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved_at: Optional[datetime] = None
    license_key: Optional[str] = None

# ============================================
# SUBSCRIPTION TIERS CONFIGURATION
# ============================================
# All plans include full features (Partner Profile + AI Wingman)
# Plans: monthly (7-day trial), quarterly, annual

SUBSCRIPTION_TIERS = {
    "monthly": {
        "name": "Monthly Training Plan",
        "display_name": "Monthly Training Plan",
        "price": 4,
        "price_cents": 400,
        "billing": "monthly",
        "has_trial": False,
        "trial_days": 0,
        "description": "Start strong with guided training and personalized insights.",
        "features": ["cycle_tracking", "tips", "research_insights", "resources", "partner_profile", "ai_wingman"],
        "has_partner_profile": True,
        "has_ai_wingman": True
    },
    "quarterly": {
        "name": "Quarter by Quarter",
        "display_name": "Quarter by Quarter",
        "price": 10,
        "price_cents": 1000,
        "billing": "every_3_months",
        "has_trial": True,
        "trial_days": 14,
        "description": "Stay consistent with a 90-day cycle designed for real relationship progress.",
        "features": ["cycle_tracking", "tips", "research_insights", "resources", "partner_profile", "ai_wingman"],
        "has_partner_profile": True,
        "has_ai_wingman": True
    },
    "annual": {
        "name": "Full Season Strategy",
        "display_name": "Full Season Strategy",
        "price": 32,
        "price_cents": 3200,
        "billing": "annual",
        "has_trial": False,
        "description": "Commit to long-term growth. Best value for men committed to leading their relationship.",
        "features": ["cycle_tracking", "tips", "research_insights", "resources", "partner_profile", "ai_wingman"],
        "has_partner_profile": True,
        "has_ai_wingman": True
    },
    "grandfathered": {
        "name": "Grandfathered (Lifetime)",
        "display_name": "Lifetime Access",
        "price": 0,
        "features": ["cycle_tracking", "tips", "research_insights", "resources", "partner_profile", "ai_wingman"],
        "has_partner_profile": True,
        "has_ai_wingman": True
    }
}

@api_router.post("/trial/request")
async def request_trial_access(request: TrialRequestInput):
    """Request trial access - Creates Stripe checkout with 30-day free trial, then converts to Winning Game Plan"""
    email = request.email.lower().strip()
    
    # Check if already has a license
    existing_license = await db.license_keys.find_one({"customer_email": email, "is_active": True, "is_cancelled": {"$ne": True}})
    if existing_license:
        return {
            "status": "already_licensed",
            "message": "This email already has access. Check your inbox for your license key."
        }
    
    # Check if already requested/approved
    existing_request = await db.trial_requests.find_one({"email": email})
    if existing_request:
        status = existing_request.get("status", "pending")
        if status == "approved":
            return {
                "status": "already_approved", 
                "message": "Your Free Training is active! Check your email for the license key."
            }
    
    # Create Stripe checkout session with 30-day trial, converts to Winning Game Plan ($1.99/mo)
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'unit_amount': SUBSCRIPTION_TIERS["monthly"]["price_cents"],
                    'recurring': {
                        'interval': 'month'
                    },
                    'product_data': {
                        'name': 'Cycle Coach - Monthly Training Plan',
                        'description': 'Monthly subscription after 30-day Free Training',
                    },
                },
                'quantity': 1,
            }],
            mode='subscription',
            subscription_data={
                'trial_period_days': 30,
                'metadata': {
                    'tier': 'free_training',
                    'converts_to': 'monthly'
                }
            },
            customer_email=email,
            success_url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}?trial=success",
            cancel_url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}?trial=cancelled",
            metadata={
                'tier': 'free_training',
                'customer_email': email,
                'is_trial': 'true'
            }
        )
        
        # Record trial request as pending (will be approved when checkout completes)
        trial_request = TrialRequest(email=email, status="pending")
        request_dict = trial_request.model_dump()
        request_dict['created_at'] = request_dict['created_at'].isoformat()
        request_dict['checkout_session_id'] = checkout_session.id
        
        await db.trial_requests.update_one(
            {"email": email},
            {"$set": request_dict},
            upsert=True
        )
        
        logger.info(f"Created trial checkout session {checkout_session.id} for {email}")
        
        return {
            "status": "checkout_required",
            "message": "Please complete checkout to start your Free Training",
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id
        }
    except Exception as e:
        logger.error(f"Error creating trial checkout: {str(e)}")
        return {
            "status": "error",
            "message": f"Unable to create checkout: {str(e)}"
        }

async def send_trial_email(customer_email: str, license_key: str, trial_end_date: datetime):
    """Send trial welcome email with license key"""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured - skipping email")
        return False
    
    expiry_date = trial_end_date.strftime("%B %d, %Y")
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }}
            .license-box {{ background: #1e293b; color: #22d3ee; padding: 20px; border-radius: 8px; text-align: center; font-family: monospace; font-size: 24px; letter-spacing: 2px; margin: 20px 0; }}
            .trial-badge {{ background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 15px; }}
            .instructions {{ background: white; padding: 20px; border-radius: 8px; margin-top: 20px; }}
            .upgrade-box {{ background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; padding: 20px; border-radius: 8px; margin-top: 20px; text-align: center; }}
            .footer {{ text-align: center; margin-top: 20px; color: #64748b; font-size: 12px; }}
            .cancel-note {{ background: #fef3c7; padding: 12px; border-radius: 6px; margin-top: 15px; color: #92400e; font-size: 13px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">🏆 Welcome to Free Training!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your 30-day training has begun</p>
            </div>
            <div class="content">
                <div style="text-align: center;">
                    <span class="trial-badge">🎯 30-Day Free Training</span>
                </div>
                
                <p>Great news! Your Free Training has started. Here's your license key:</p>
                
                <div class="license-box">
                    {license_key}
                </div>
                
                <p style="text-align: center; color: #64748b; font-size: 14px;">
                    Free Training ends: <strong>{expiry_date}</strong><br/>
                    <em>Then continues as Winning Game Plan ($1.99/mo)</em>
                </p>
                
                <div class="instructions">
                    <h3 style="margin-top: 0;">What's included in Free Training:</h3>
                    <ul>
                        <li>✅ Cycle tracking & phase predictions</li>
                        <li>✅ Research-backed insights & tips</li>
                        <li>✅ Educational resources</li>
                    </ul>
                    <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">
                        <em>Partner Profile and AI Wingman are available with Elite Game Plan.</em>
                    </p>
                </div>
                
                <div class="cancel-note">
                    💡 <strong>Cancel anytime</strong> - You won't be charged during your 30-day Free Training. If you cancel before it ends, you won't be billed.
                </div>
                
                <div class="upgrade-box">
                    <h3 style="margin: 0 0 10px 0;">Want the full experience?</h3>
                    <p style="margin: 0; opacity: 0.9;">Upgrade to Elite Game Plan for Partner Profile + AI Wingman</p>
                    <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold;">Only $2.99/month</p>
                </div>
            </div>
            <div class="footer">
                <p>Cycle Coach - Your relationship game-changer</p>
                <p>Questions? Reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [customer_email],
            "subject": "🏆 Your Cycle Coach Free Training Has Begun!",
            "html": html_content
        }
        
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Trial email sent to {customer_email}, email_id: {email_result.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send trial email: {str(e)}")
        return False

# ============================================
# FEEDBACK SYSTEM
# ============================================

class FeedbackInput(BaseModel):
    email: str
    rating: int  # 1-5 stars
    feedback_text: Optional[str] = None
    feedback_type: str  # 'trial_midpoint', 'trial_end', 'cancellation', 'general'
    subscription_tier: Optional[str] = None

@api_router.post("/feedback/submit")
async def submit_feedback(request: FeedbackInput):
    """Submit user feedback"""
    email = request.email.lower().strip()
    
    if request.rating < 1 or request.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    feedback_doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "rating": request.rating,
        "feedback_text": request.feedback_text,
        "feedback_type": request.feedback_type,
        "subscription_tier": request.subscription_tier,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.feedback.insert_one(feedback_doc)
    logger.info(f"Feedback submitted from {email}: {request.rating} stars ({request.feedback_type})")
    
    return {
        "status": "success",
        "message": "Thank you for your feedback!"
    }

@api_router.get("/feedback/check/{email}")
async def check_feedback_status(email: str):
    """Check if user should be prompted for feedback based on their subscription status"""
    email = email.lower().strip()
    
    # Get user's license info
    license = await db.license_keys.find_one(
        {"customer_email": email, "is_active": True},
        {"_id": 0}
    )
    
    if not license:
        return {"should_prompt": False, "reason": "no_active_license"}
    
    # Check existing feedback
    existing_feedback = await db.feedback.find(
        {"email": email},
        {"_id": 0, "feedback_type": 1, "created_at": 1}
    ).to_list(100)
    
    feedback_types_given = [f["feedback_type"] for f in existing_feedback]
    
    # Calculate days since subscription started
    created_at = license.get("created_at")
    if created_at:
        start_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        days_active = (datetime.now(timezone.utc) - start_date).days
    else:
        days_active = 0
    
    is_trial = license.get("is_trial", False)
    tier = license.get("subscription_tier", "free_training")
    
    # Determine if we should prompt
    prompts_needed = []
    
    # Day 7 feedback (only for trial users)
    if is_trial and days_active >= 7 and "trial_day7" not in feedback_types_given:
        prompts_needed.append("trial_day7")
    
    # Conversion feedback (when user converted from trial to paid)
    # Check if they had a trial before and now have a paid subscription
    if not is_trial and tier in ["winning", "elite"]:
        # Check if they already gave conversion feedback
        if "conversion" not in feedback_types_given:
            # Check if this is a recent conversion (within last 2 days)
            converted_at = license.get("converted_at") or license.get("created_at")
            if converted_at:
                convert_date = datetime.fromisoformat(converted_at.replace('Z', '+00:00'))
                days_since_conversion = (datetime.now(timezone.utc) - convert_date).days
                if days_since_conversion <= 2:
                    prompts_needed.append("conversion")
    
    return {
        "should_prompt": len(prompts_needed) > 0,
        "prompt_type": prompts_needed[0] if prompts_needed else None,
        "days_active": days_active,
        "is_trial": license.get("is_trial", False),
        "tier": license.get("subscription_tier", "unknown")
    }

# ============ ADMIN AUTHENTICATION ============

# Admin password from environment variable
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')

class AdminLoginRequest(BaseModel):
    password: str

class AdminLoginResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None

@api_router.post("/admin/login")
async def admin_login(request: AdminLoginRequest):
    """Authenticate admin user"""
    if not ADMIN_PASSWORD:
        logger.error("ADMIN_PASSWORD not configured in environment")
        raise HTTPException(status_code=500, detail="Admin authentication not configured")
    
    if request.password == ADMIN_PASSWORD:
        # Generate a simple admin session token
        admin_token = secrets.token_urlsafe(32)
        
        # Store admin session in database with expiry
        admin_session = {
            "token": admin_token,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        }
        
        # Upsert - only one admin session at a time
        await db.admin_sessions.delete_many({})
        await db.admin_sessions.insert_one(admin_session)
        
        logger.info("Admin login successful")
        return AdminLoginResponse(
            success=True,
            message="Admin access granted",
            token=admin_token
        )
    else:
        logger.warning("Failed admin login attempt")
        raise HTTPException(status_code=401, detail="Invalid password")

@api_router.post("/admin/verify")
async def verify_admin_token(authorization: Optional[str] = Header(None)):
    """Verify admin token is still valid"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token provided")
    
    token = authorization.replace("Bearer ", "")
    
    # Check token in database
    session = await db.admin_sessions.find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Check expiry
    expires_at = datetime.fromisoformat(session['expires_at'])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await db.admin_sessions.delete_one({"token": token})
        raise HTTPException(status_code=401, detail="Token expired")
    
    return {"valid": True}

@api_router.post("/admin/logout")
async def admin_logout(authorization: Optional[str] = Header(None)):
    """Logout admin user"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        await db.admin_sessions.delete_one({"token": token})
    
    return {"message": "Logged out successfully"}

@api_router.get("/admin/feedback")
async def get_all_feedback():
    """Get all feedback (admin endpoint)"""
    feedback_list = await db.feedback.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Calculate stats
    total = len(feedback_list)
    avg_rating = sum(f["rating"] for f in feedback_list) / total if total > 0 else 0
    
    return {
        "feedback": feedback_list,
        "stats": {
            "total_feedback": total,
            "average_rating": round(avg_rating, 2),
            "by_type": {}
        }
    }

@api_router.get("/trial/requests")
async def get_trial_requests(status: Optional[str] = None):
    """Get all trial requests (admin endpoint)"""
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.trial_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"requests": requests, "count": len(requests)}

@api_router.post("/trial/approve/{email}")
async def approve_trial_request(email: str):
    """Approve a trial request - generates 1-MONTH trial license key and sends email"""
    email = email.lower().strip()
    
    # Find the request
    trial_request = await db.trial_requests.find_one({"email": email})
    if not trial_request:
        raise HTTPException(status_code=404, detail="Trial request not found")
    
    if trial_request.get("status") == "approved":
        return {
            "status": "already_approved",
            "license_key": trial_request.get("license_key")
        }
    
    # Generate license key
    license_key = generate_license_key()
    while await db.license_keys.find_one({"license_key": license_key}):
        license_key = generate_license_key()
    
    # Set expiration to 1 month from now
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    
    # Save license to database
    license_record = LicenseKey(
        license_key=license_key,
        customer_email=email,
        stripe_session_id=f"trial_{uuid.uuid4()}",
        stripe_payment_intent=None
    )
    
    license_dict = license_record.model_dump()
    license_dict['created_at'] = license_dict['created_at'].isoformat()
    license_dict['is_trial'] = True
    license_dict['key_type'] = 'trial'  # trial, yearly, lifetime
    license_dict['expires_at'] = expires_at.isoformat()
    await db.license_keys.insert_one(license_dict)
    
    # Update trial request status
    await db.trial_requests.update_one(
        {"email": email},
        {
            "$set": {
                "status": "approved",
                "approved_at": datetime.now(timezone.utc).isoformat(),
                "license_key": license_key
            }
        }
    )
    
    logger.info(f"Approved trial for {email}, license: {license_key}, expires: {expires_at}")
    
    # Send email with license key
    email_sent = await send_license_email(email, license_key)
    
    return {
        "status": "approved",
        "email": email,
        "license_key": license_key,
        "key_type": "trial",
        "expires_at": expires_at.isoformat(),
        "email_sent": email_sent
    }

@api_router.post("/trial/reject/{email}")
async def reject_trial_request(email: str):
    """Reject a trial request"""
    email = email.lower().strip()
    
    result = await db.trial_requests.update_one(
        {"email": email},
        {"$set": {"status": "rejected"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Trial request not found")
    
    return {"status": "rejected", "email": email}

class GrantKeyRequest(BaseModel):
    email: str
    key_type: str  # 'lifetime' or 'yearly'

@api_router.post("/admin/grant-key")
async def grant_key(request: GrantKeyRequest):
    """Grant a lifetime or yearly key to a user (for approved testers after trial)"""
    email = request.email.lower().strip()
    key_type = request.key_type.lower()
    
    if key_type not in ['lifetime', 'yearly']:
        raise HTTPException(status_code=400, detail="key_type must be 'lifetime' or 'yearly'")
    
    # Generate license key
    license_key = generate_license_key()
    while await db.license_keys.find_one({"license_key": license_key}):
        license_key = generate_license_key()
    
    # Set expiration based on key type
    expires_at = None
    if key_type == 'yearly':
        expires_at = datetime.now(timezone.utc) + timedelta(days=365)
    # lifetime keys have no expiration (expires_at = None)
    
    # Save license to database
    license_dict = {
        "id": str(uuid.uuid4()),
        "license_key": license_key,
        "customer_email": email,
        "stripe_session_id": f"admin_grant_{uuid.uuid4()}",
        "stripe_payment_intent": None,
        "is_active": True,
        "is_trial": False,
        "key_type": key_type,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "activation_count": 0
    }
    await db.license_keys.insert_one(license_dict)
    
    logger.info(f"Granted {key_type} key to {email}: {license_key}")
    
    # Send email with the new key
    email_sent = await send_upgrade_email(email, license_key, key_type)
    
    return {
        "status": "success",
        "email": email,
        "license_key": license_key,
        "key_type": key_type,
        "expires_at": expires_at.isoformat() if expires_at else "never",
        "email_sent": email_sent
    }

@api_router.get("/admin/users")
async def get_all_users(archived: bool = False, cancelled: bool = False, key_type: Optional[str] = None):
    """Get all users with their license info"""
    if archived:
        query = {"is_archived": True}
    elif cancelled:
        query = {"is_cancelled": True}
    else:
        query = {"is_archived": {"$ne": True}, "is_cancelled": {"$ne": True}}
    
    # Filter by key_type if specified
    if key_type and not archived and not cancelled:
        if key_type == 'trial':
            # Trial includes both explicit 'trial' and missing key_type (legacy)
            query["$or"] = [{"key_type": "trial"}, {"key_type": {"$exists": False}}, {"key_type": None}]
        else:
            query["key_type"] = key_type
    
    licenses = await db.license_keys.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"users": licenses, "count": len(licenses)}

@api_router.post("/admin/archive-user/{email}")
async def archive_user(email: str):
    """Archive a user (hide from main list)"""
    email = email.lower().strip()
    
    result = await db.license_keys.update_many(
        {"customer_email": email},
        {"$set": {"is_archived": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "archived", "email": email}

@api_router.post("/admin/unarchive-user/{email}")
async def unarchive_user(email: str):
    """Unarchive a user"""
    email = email.lower().strip()
    
    result = await db.license_keys.update_many(
        {"customer_email": email},
        {"$set": {"is_archived": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "unarchived", "email": email}

@api_router.post("/admin/cancel-user/{email}")
async def cancel_user(email: str):
    """Cancel a user's access"""
    email = email.lower().strip()
    
    result = await db.license_keys.update_many(
        {"customer_email": email},
        {"$set": {"is_cancelled": True, "is_active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "cancelled", "email": email}

@api_router.post("/admin/restore-user/{email}")
async def restore_user(email: str):
    """Restore a cancelled user's access"""
    email = email.lower().strip()
    
    result = await db.license_keys.update_many(
        {"customer_email": email},
        {"$set": {"is_cancelled": False, "is_active": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "restored", "email": email}

@api_router.get("/admin/stats")
async def get_admin_stats():
    """Get overall stats for dashboard"""
    # Trial requests stats
    pending_count = await db.trial_requests.count_documents({"status": "pending"})
    approved_count = await db.trial_requests.count_documents({"status": "approved"})
    rejected_count = await db.trial_requests.count_documents({"status": "rejected"})
    
    # User/license stats (non-archived only)
    # Trial includes legacy keys without key_type
    trial_count = await db.license_keys.count_documents({
        "$or": [{"key_type": "trial"}, {"key_type": {"$exists": False}}, {"key_type": None}],
        "is_archived": {"$ne": True},
        "is_cancelled": {"$ne": True}
    })
    monthly_count = await db.license_keys.count_documents({"key_type": "monthly", "is_archived": {"$ne": True}, "is_cancelled": {"$ne": True}})
    yearly_count = await db.license_keys.count_documents({"key_type": "yearly", "is_archived": {"$ne": True}, "is_cancelled": {"$ne": True}})
    lifetime_count = await db.license_keys.count_documents({"key_type": "lifetime", "is_archived": {"$ne": True}, "is_cancelled": {"$ne": True}})
    cancelled_count = await db.license_keys.count_documents({"is_cancelled": True})
    archived_count = await db.license_keys.count_documents({"is_archived": True})
    
    return {
        "requests": {
            "pending": pending_count,
            "approved": approved_count,
            "rejected": rejected_count
        },
        "users": {
            "trial": trial_count,
            "monthly": monthly_count,
            "yearly": yearly_count,
            "lifetime": lifetime_count,
            "cancelled": cancelled_count,
            "archived": archived_count
        }
    }

async def send_upgrade_email(customer_email: str, license_key: str, key_type: str):
    """Send upgraded license key to customer via Resend"""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured - skipping email")
        return False
    
    duration_text = "lifetime" if key_type == "lifetime" else "one year"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }}
            .license-box {{ background: #1e293b; color: #22d3ee; padding: 20px; border-radius: 8px; text-align: center; font-family: monospace; font-size: 24px; letter-spacing: 2px; margin: 20px 0; }}
            .badge {{ display: inline-block; background: #22d3ee; color: #0f172a; padding: 5px 15px; border-radius: 20px; font-weight: bold; margin-bottom: 15px; }}
            .footer {{ text-align: center; margin-top: 20px; color: #64748b; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">🎁 You've Been Upgraded!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Thank you for being an amazing tester</p>
            </div>
            <div class="content">
                <div style="text-align: center;">
                    <span class="badge">{key_type.upper()} ACCESS</span>
                </div>
                
                <p>As a thank you for your valuable feedback during the trial, you've been granted <strong>{duration_text} access</strong> to Cycle Coach!</p>
                
                <p>Here's your new license key:</p>
                
                <div class="license-box">
                    {license_key}
                </div>
                
                <p><strong>Important:</strong> This key replaces your trial key. Clear your app data and enter this new key to activate your {duration_text} access.</p>
                
                <p>Thank you for helping make Cycle Coach better! 🙏</p>
            </div>
            <div class="footer">
                <p>Cycle Coach - Your relationship game-changer</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [customer_email],
            "subject": f"🎁 Your Cycle Coach {key_type.title()} Key",
            "html": html_content
        }
        
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Upgrade email sent to {customer_email}, email_id: {email_result.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send upgrade email: {str(e)}")
        return False

# ============================================
# ANONYMOUS CHAT ENDPOINT (Privacy-First)
# ============================================

class PartnerProfileContext(BaseModel):
    partner_name: Optional[str] = None
    preferences: Optional[dict] = None
    cycle_length: Optional[int] = None

class AnonymousChatRequest(BaseModel):
    message: str
    cycle_day: Optional[int] = None
    phase: Optional[str] = None
    partner_profile: Optional[PartnerProfileContext] = None

@api_router.post("/chat/anonymous")
async def anonymous_chat(request: AnonymousChatRequest):
    """
    Privacy-first anonymous chat endpoint
    - No user authentication required
    - No conversation persistence
    - Truly anonymous session IDs
    - No logging of user data
    - Uses Partner Profile for personalization (passed from client, not stored)
    """
    
    try:
        # Generate truly random anonymous session (not linked to any user)
        import secrets
        anonymous_session = f"anon_{secrets.token_hex(8)}"
        
        # Build context without any identifying information
        context = ""
        if request.cycle_day and request.phase:
            context = f"Current cycle context: Day {request.cycle_day} - {request.phase} phase\n\n"
        
        # Build Partner Profile context for personalization
        partner_context = ""
        if request.partner_profile:
            pp = request.partner_profile
            if pp.partner_name:
                partner_context += f"Partner's name: {pp.partner_name}\n"
            if pp.cycle_length:
                partner_context += f"Her typical cycle length: {pp.cycle_length} days\n"
            if pp.preferences:
                prefs = pp.preferences
                # Food & Drinks
                if prefs.get('coffee_order'):
                    partner_context += f"Her coffee order: {prefs['coffee_order']}\n"
                if prefs.get('comfort_food'):
                    partner_context += f"Her comfort food: {prefs['comfort_food']}\n"
                if prefs.get('ice_cream'):
                    partner_context += f"Favorite ice cream: {prefs['ice_cream']}\n"
                # Emotional Preferences
                if prefs.get('love_language'):
                    partner_context += f"Her love language: {prefs['love_language']}\n"
                if prefs.get('stressed_preference'):
                    partner_context += f"When stressed, she wants: {prefs['stressed_preference']}\n"
                # Gifts & Activities
                if prefs.get('gift_ideas'):
                    partner_context += f"Gift ideas that work: {prefs['gift_ideas']}\n"
                if prefs.get('date_ideas'):
                    partner_context += f"Favorite date activities: {prefs['date_ideas']}\n"
                # Entertainment - Movies & TV
                if prefs.get('movie_genre'):
                    partner_context += f"Movie genres she likes: {prefs['movie_genre']}\n"
                if prefs.get('favorite_movies'):
                    partner_context += f"Her favorite movies: {prefs['favorite_movies']}\n"
                if prefs.get('tv_series'):
                    partner_context += f"TV series she loves: {prefs['tv_series']}\n"
                # Entertainment - Music & Podcasts
                if prefs.get('music_artists'):
                    partner_context += f"Music artists she likes: {prefs['music_artists']}\n"
                if prefs.get('music_genres'):
                    partner_context += f"Music genres: {prefs['music_genres']}\n"
                if prefs.get('podcast_shows'):
                    partner_context += f"Podcasts she listens to: {prefs['podcast_shows']}\n"
            if partner_context:
                partner_context = f"\nPartner Profile (ALWAYS reference these details in your advice - use her name, specific preferences, etc.):\n{partner_context}\n"
        
        # Create ephemeral AI chat (no history persistence)
        system_prompt = f"""You're the ultimate relationship wingman - like texting your wise older bro at 2am.

{context}{partner_context}
RESPONSE STYLE:
- Short and direct (3-5 sentences max per point)
- Use bullet points with • for multiple tips
- Actionable and specific
- Humorous and relatable
- **Bold** key phrases for emphasis

PERSONALIZATION RULES (CRITICAL):
- ALWAYS use her name from the Partner Profile when giving advice
- Reference her specific preferences (coffee, food, entertainment) whenever relevant
- If asked "what should we watch?" → Check her favorite movies/TV/genres and suggest something similar
- If asked about gifts/dates → Use her documented preferences
- Make it feel like you actually KNOW her, not generic advice

NO identifying details about the user. Give straight-up personalized advice."""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=anonymous_session,
            system_message=system_prompt
        ).with_model("openai", "gpt-5")
        
        # Send message and get response
        response = await chat.send_message(UserMessage(text=request.message))
        
        # Do NOT save to database - ephemeral only
        # Do NOT log user message or response
        
        return {"response": response}
        
    except Exception as e:
        logging.error(f"Anonymous chat error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process chat message")

# ============================================================
# CONTACT FORM ENDPOINT
# ============================================================

class ContactRequest(BaseModel):
    name: str = "Anonymous"
    email: str
    message: str

# Internal contact email - not exposed to frontend
CONTACT_EMAIL = "cyclecoach4men@gmail.com"

@api_router.post("/contact")
async def submit_contact(request: ContactRequest):
    """
    Contact form submission endpoint
    - Sends message to internal support email
    - Destination email is kept private
    """
    if not request.email or not request.message:
        raise HTTPException(status_code=400, detail="Email and message are required")
    
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured - cannot send contact form")
        raise HTTPException(status_code=500, detail="Email service not configured")
    
    try:
        # Send email to internal support address
        params = {
            "from": "Cycle Coach <noreply@updates.emergent.sh>",
            "to": [CONTACT_EMAIL],
            "subject": f"Cycle Coach Contact Form - {request.name}",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0891b2;">New Contact Form Submission</h2>
                <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>From:</strong> {request.name}</p>
                    <p><strong>Email:</strong> {request.email}</p>
                    <p><strong>Message:</strong></p>
                    <p style="white-space: pre-wrap; background: white; padding: 15px; border-radius: 4px;">{request.message}</p>
                </div>
                <p style="color: #64748b; font-size: 12px;">
                    Submitted via Cycle Coach contact form
                </p>
            </div>
            """,
            "reply_to": request.email
        }
        
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Contact form email sent: {email_result}")
        
        return {"success": True, "message": "Message sent successfully"}
        
    except Exception as e:
        logger.error(f"Error sending contact form: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send message")

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

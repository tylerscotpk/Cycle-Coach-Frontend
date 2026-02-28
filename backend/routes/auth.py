"""Auth routes: /api/auth/* and /api/account/*"""
from fastapi import APIRouter, HTTPException, Cookie, Header, Response
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import db
import os
import logging
import asyncio
import uuid
import secrets
import hashlib
import resend
import stripe

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'info@cyclecoach.net')

# ============ HELPERS ============

def hash_password(password: str) -> str:
    salt = os.environ.get('PASSWORD_SALT', 'cyclecoach_default_salt_2024')
    return hashlib.sha256(f"{password}{salt}".encode()).hexdigest()


def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


async def send_welcome_email(email: str):
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


# ============ REQUEST MODELS ============

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


# ============ AUTH ROUTES ============

@router.post("/auth/register")
async def register_user(request: RegisterRequest, response: Response):
    try:
        email = request.email.lower().strip()

        if '@' not in email or '.' not in email:
            raise HTTPException(status_code=400, detail="Invalid email format")
        if len(request.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        if request.password != request.confirm_password:
            raise HTTPException(status_code=400, detail="Passwords do not match")

        existing_user = await db.auth_users.find_one({"email": email})
        if existing_user:
            raise HTTPException(status_code=400, detail="An account with this email already exists")

        if request.phone:
            phone = request.phone.strip()
            existing_phone = await db.auth_users.find_one({"phone": phone})
            if existing_phone:
                raise HTTPException(status_code=400, detail="An account with this phone number already exists")

        user_id = str(uuid.uuid4())
        password_hash = hash_password(request.password)

        auth_user = {
            "id": user_id,
            "email": email,
            "phone": request.phone.strip() if request.phone else None,
            "password_hash": password_hash,
            "is_active": True,
            "subscription_status": None,
            "subscription_id": None,
            "subscription_tier": None,
            "trial_ends_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.auth_users.insert_one(auth_user)

        session_token = secrets.token_urlsafe(32)
        session = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_sessions.insert_one(session)

        response.set_cookie(
            key="session_token", value=session_token,
            httponly=True, secure=True, samesite="lax",
            max_age=30 * 24 * 60 * 60
        )

        logger.info(f"New user registered: {email}")
        asyncio.create_task(send_welcome_email(email))

        return {
            "success": True,
            "message": "Account created successfully",
            "user": {"id": user_id, "email": email, "has_subscription": False},
            "session_token": session_token
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create account")


@router.post("/auth/login")
async def login_user(request: LoginRequest, response: Response):
    try:
        identifier = request.email_or_phone.lower().strip()

        user = await db.auth_users.find_one({
            "$or": [{"email": identifier}, {"phone": identifier}]
        })

        if not user:
            raise HTTPException(status_code=401, detail="Invalid email/phone or password")

        if user.get("password_hash") != hash_password(request.password):
            raise HTTPException(status_code=401, detail="Invalid email/phone or password")

        if not user.get("is_active", True):
            raise HTTPException(status_code=401, detail="Account is disabled")

        session_token = secrets.token_urlsafe(32)
        session = {
            "user_id": user["id"],
            "session_token": session_token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_sessions.insert_one(session)

        response.set_cookie(
            key="session_token", value=session_token,
            httponly=True, secure=True, samesite="lax",
            max_age=30 * 24 * 60 * 60
        )

        has_subscription = False
        subscription_status = user.get("subscription_status")
        trial_ends_at = user.get("trial_ends_at")
        if subscription_status in ("active", "cancelling"):
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


@router.post("/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}


@router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    try:
        email = request.email.lower().strip()
        user = await db.auth_users.find_one({"email": email})

        if not user:
            return {"success": True, "message": "If an account exists, a reset link has been sent"}

        reset_token = generate_reset_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        await db.password_resets.delete_many({"user_id": user["id"]})
        await db.password_resets.insert_one({
            "user_id": user["id"],
            "email": email,
            "token": reset_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })

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


@router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    try:
        reset_record = await db.password_resets.find_one({"token": request.token})
        if not reset_record:
            raise HTTPException(status_code=400, detail="Invalid or expired reset link")

        expires_at = datetime.fromisoformat(reset_record["expires_at"].replace('Z', '+00:00'))
        if expires_at < datetime.now(timezone.utc):
            await db.password_resets.delete_one({"token": request.token})
            raise HTTPException(status_code=400, detail="Reset link has expired")

        if len(request.new_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

        password_hash = hash_password(request.new_password)
        await db.auth_users.update_one(
            {"id": reset_record["user_id"]},
            {"$set": {"password_hash": password_hash, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        await db.password_resets.delete_one({"token": request.token})
        await db.user_sessions.delete_many({"user_id": reset_record["user_id"]})

        logger.info(f"Password reset for user: {reset_record['email']}")
        return {"success": True, "message": "Password reset successfully. Please log in with your new password."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset password error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to reset password")


@router.get("/auth/check")
async def check_auth(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    try:
        token = session_token
        if not token and authorization and authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")

        if not token:
            return {"authenticated": False, "has_subscription": False}

        session = await db.user_sessions.find_one({"session_token": token})
        if not session:
            return {"authenticated": False, "has_subscription": False}

        expires_at = session.get('expires_at')
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        if expires_at < datetime.now(timezone.utc):
            return {"authenticated": False, "has_subscription": False}

        user = await db.auth_users.find_one({"id": session["user_id"]})
        if not user:
            return {"authenticated": False, "has_subscription": False}

        has_subscription = False
        subscription_status = user.get("subscription_status")
        trial_ends_at = user.get("trial_ends_at")

        if subscription_status in ("active", "trialing", "cancelling"):
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


@router.get("/account/subscription")
async def get_account_subscription(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
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


@router.post("/account/cancel-subscription")
async def cancel_user_subscription(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
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
        updated_subscription = stripe.Subscription.modify(subscription_id, cancel_at_period_end=True)
        cancel_at = updated_subscription.current_period_end
        cancels_at_date = datetime.fromtimestamp(cancel_at, tz=timezone.utc).isoformat()

        await db.auth_users.update_one(
            {"id": session["user_id"]},
            {"$set": {
                "subscription_status": "cancelling",
                "cancels_at": cancels_at_date,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
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
        return {"success": True, "message": "Subscription cancelled successfully", "cancels_at": cancels_at_date}
    except stripe.StripeError as e:
        logger.error(f"Stripe error cancelling subscription: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to cancel: {str(e)}")

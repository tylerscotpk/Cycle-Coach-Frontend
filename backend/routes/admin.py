"""Admin routes — authentication, user management, stats, feedback."""
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import db
import secrets
import hmac
import hashlib
import uuid
import string
import os
import logging
import asyncio
import resend
import stripe

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'info@cyclecoach.net')

LOGIN_WINDOW = timedelta(minutes=15)
MAX_FAILS_PER_IP = 5
MAX_FAILS_GLOBAL = 30
_verified_tokens = {}  # (token, password hash) -> verified fingerprint; process-local cache


def _admin_password():
    return os.environ.get('ADMIN_PASSWORD')


def _password_fp(password, salt):
    """Per-session fingerprint of the admin password; a session is valid only while the password is unchanged."""
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()


def _client_ip(request: Request):
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


async def _session_valid(token):
    session = await db.admin_sessions.find_one({"token": token})
    if not session:
        return False
    expires_at = datetime.fromisoformat(session['expires_at'])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    password = _admin_password()
    if expires_at < datetime.now(timezone.utc) or not password or not session.get("pw_salt") or not session.get("pw_fp"):
        await db.admin_sessions.delete_one({"token": token})
        return False
    cache_key = (token, hashlib.sha256(password.encode()).hexdigest())  # in-memory only; misses if password changes
    if _verified_tokens.get(cache_key) == session["pw_fp"]:
        return True
    if not hmac.compare_digest(_password_fp(password, session["pw_salt"]), session["pw_fp"]):
        # Password changed since this session was created → revoke it
        await db.admin_sessions.delete_one({"token": token})
        return False
    _verified_tokens[cache_key] = session["pw_fp"]
    return True


# ── Admin auth dependency ───────────────────────────────────────────

async def require_admin(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Admin authentication required")
    if not await _session_valid(authorization[7:]):
        raise HTTPException(status_code=401, detail="Invalid or expired admin session")
    return True

# ── Models ──────────────────────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    password: str

class AdminLoginResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None

class GrantKeyRequest(BaseModel):
    email: str
    key_type: str

# ── Auth endpoints ──────────────────────────────────────────────────

@router.post("/admin/login")
async def admin_login(body: AdminLoginRequest, request: Request):
    password = _admin_password()
    if not password:
        logger.error("ADMIN_PASSWORD not configured")
        raise HTTPException(status_code=500, detail="Admin authentication not configured")
    ip = _client_ip(request)
    since = datetime.now(timezone.utc) - LOGIN_WINDOW
    await db.admin_login_failures.create_index("at", expireAfterSeconds=int(LOGIN_WINDOW.total_seconds()) * 2)
    ip_fails = await db.admin_login_failures.count_documents({"ip": ip, "at": {"$gte": since}})
    all_fails = await db.admin_login_failures.count_documents({"at": {"$gte": since}})
    if ip_fails >= MAX_FAILS_PER_IP or all_fails >= MAX_FAILS_GLOBAL:
        logger.warning("Admin login temporarily locked after repeated failures")
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please wait 15 minutes and try again.",
                            headers={"Retry-After": str(int(LOGIN_WINDOW.total_seconds()))})
    if hmac.compare_digest(body.password.encode(), password.encode()):
        admin_token = secrets.token_urlsafe(32)
        salt = secrets.token_hex(16)
        now = datetime.now(timezone.utc)
        await db.admin_sessions.delete_many({})
        _verified_tokens.clear()
        await db.admin_sessions.insert_one({
            "token": admin_token, "pw_salt": salt, "pw_fp": _password_fp(password, salt),
            "created_at": now.isoformat(), "expires_at": (now + timedelta(hours=24)).isoformat(),
        })
        await db.admin_login_failures.delete_many({"ip": ip})
        logger.info("Admin login successful")
        return AdminLoginResponse(success=True, message="Admin access granted", token=admin_token)
    await db.admin_login_failures.insert_one({"ip": ip, "at": datetime.now(timezone.utc)})
    logger.warning("Failed admin login attempt")
    raise HTTPException(status_code=401, detail="Invalid password")

@router.post("/admin/verify")
async def verify_admin_token(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token provided")
    if not await _session_valid(authorization[7:]):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"valid": True}

@router.post("/admin/logout")
async def admin_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        await db.admin_sessions.delete_one({"token": token})
        _verified_tokens.clear()
    return {"message": "Logged out successfully"}

# ── Feedback ────────────────────────────────────────────────────────

@router.get("/admin/feedback")
async def get_all_feedback(_=Depends(require_admin)):
    feedback_list = await db.feedback.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    total = len(feedback_list)
    avg_rating = sum(f["rating"] for f in feedback_list) / total if total > 0 else 0
    return {
        "feedback": feedback_list,
        "stats": {"total_feedback": total, "average_rating": round(avg_rating, 2), "by_type": {}},
    }

# ── Legacy trial endpoints ──────────────────────────────────────────

@router.get("/trial/requests")
async def get_trial_requests(status: Optional[str] = None, _=Depends(require_admin)):
    query = {}
    if status:
        query["status"] = status
    requests = await db.trial_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"requests": requests, "count": len(requests)}

@router.post("/trial/approve/{email}")
async def approve_trial_request(email: str, _=Depends(require_admin)):
    email = email.lower().strip()
    trial_request = await db.trial_requests.find_one({"email": email})
    if not trial_request:
        raise HTTPException(status_code=404, detail="Trial request not found")
    if trial_request.get("status") == "approved":
        return {"status": "already_approved", "license_key": trial_request.get("license_key")}
    raise HTTPException(status_code=410, detail="Legacy trial approval is deprecated. Use subscription system instead.")

@router.post("/trial/reject/{email}")
async def reject_trial_request(email: str, _=Depends(require_admin)):
    email = email.lower().strip()
    result = await db.trial_requests.update_one({"email": email}, {"$set": {"status": "rejected"}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Trial request not found")
    return {"status": "rejected", "email": email}

# ── License key grant ───────────────────────────────────────────────

def generate_license_key():
    segments = []
    for _ in range(3):
        segment = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(4))
        segments.append(segment)
    return f"CC-{'-'.join(segments)}"

async def send_upgrade_email(customer_email, license_key, key_type):
    if not RESEND_API_KEY:
        return False
    duration_text = "lifetime" if key_type == "lifetime" else "one year"
    html_content = f"""<!DOCTYPE html><html><head><style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
        .content {{ background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }}
        .license-box {{ background: #1e293b; color: #22d3ee; padding: 20px; border-radius: 8px; text-align: center; font-family: monospace; font-size: 24px; letter-spacing: 2px; margin: 20px 0; }}
    </style></head><body><div class="container">
        <div class="header"><h1 style="margin:0;">You've Been Upgraded!</h1></div>
        <div class="content">
            <p>You've been granted <strong>{duration_text} access</strong> to Cycle Coach!</p>
            <div class="license-box">{license_key}</div>
            <p>Thank you for helping make Cycle Coach better!</p>
        </div></div></body></html>"""
    try:
        params = {"from": SENDER_EMAIL, "to": [customer_email], "subject": f"Your Cycle Coach {key_type.title()} Key", "html": html_content}
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Upgrade email sent to {customer_email}, email_id: {email_result.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send upgrade email: {e}")
        return False

@router.post("/admin/grant-key")
async def grant_key(request: GrantKeyRequest, _=Depends(require_admin)):
    email = request.email.lower().strip()
    key_type = request.key_type.lower()
    if key_type not in ['lifetime', 'yearly']:
        raise HTTPException(status_code=400, detail="key_type must be 'lifetime' or 'yearly'")
    license_key = generate_license_key()
    while await db.license_keys.find_one({"license_key": license_key}):
        license_key = generate_license_key()
    expires_at = None
    if key_type == 'yearly':
        expires_at = datetime.now(timezone.utc) + timedelta(days=365)
    license_dict = {
        "id": str(uuid.uuid4()), "license_key": license_key, "customer_email": email,
        "stripe_session_id": f"admin_grant_{uuid.uuid4()}", "stripe_payment_intent": None,
        "is_active": True, "is_trial": False, "key_type": key_type,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "created_at": datetime.now(timezone.utc).isoformat(), "activation_count": 0,
    }
    await db.license_keys.insert_one(license_dict)
    logger.info(f"Granted {key_type} key to {email}: {license_key}")
    email_sent = await send_upgrade_email(email, license_key, key_type)
    return {"status": "success", "email": email, "license_key": license_key, "key_type": key_type, "expires_at": expires_at.isoformat() if expires_at else "never", "email_sent": email_sent}

# ── User management ─────────────────────────────────────────────────

@router.get("/admin/users")
async def get_all_users(cancelled: bool = False, subscription_tier: Optional[str] = None, plan_type: Optional[str] = None, no_plan: bool = False, deactivated: bool = False, _=Depends(require_admin)):
    query = {"is_active": True}
    if deactivated:
        query = {"is_active": False}
    elif cancelled:
        query = {"subscription_status": {"$in": ["cancelled", "cancelling"]}}
    elif no_plan:
        query["$or"] = [{"subscription_status": None}, {"subscription_status": {"$exists": False}}]
    elif plan_type:
        query["plan_type"] = plan_type
    elif subscription_tier:
        query["subscription_tier"] = subscription_tier
    users = await db.auth_users.find(query, {"_id": 0, "password_hash": 0, "verification_token": 0}).sort("created_at", -1).to_list(200)
    return {"users": users, "count": len(users)}

@router.post("/admin/archive-user/{email}")
async def archive_user(email: str, _=Depends(require_admin)):
    email = email.lower().strip()
    user = await db.auth_users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    result = await db.auth_users.update_one(
        {"email": email},
        {"$set": {"is_active": False, "pre_deactivation_status": user.get("subscription_status"), "pre_deactivation_tier": user.get("subscription_tier"), "pre_deactivation_plan": user.get("plan_type"), "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found or already deactivated")
    if RESEND_API_KEY:
        try:
            await asyncio.to_thread(resend.Emails.send, {
                "from": SENDER_EMAIL, "to": [email], "subject": "Your Cycle Coach Account Has Been Deactivated",
                "html": f'<div style="font-family:Arial;max-width:600px;margin:auto;padding:20px"><div style="background:linear-gradient(135deg,#0f172a,#1e293b);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0"><h1 style="margin:0">Account Deactivated</h1></div><div style="background:#f8fafc;padding:30px;border-radius:0 0 10px 10px"><p>Your Cycle Coach account has been deactivated.</p><p>If you believe this is an error, please contact our support team.</p><div style="text-align:center;margin:25px 0"><a href="https://cyclecoach.net/info/contact" style="display:inline-block;background:#0891b2;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold">Contact Support</a></div><p style="color:#64748b;font-size:13px">— The Cycle Coach Team</p></div></div>',
            })
        except Exception as e:
            logger.error(f"Failed to send deactivation email to {email}: {e}")
    return {"status": "archived", "email": email}

@router.post("/admin/unarchive-user/{email}")
async def unarchive_user(email: str, _=Depends(require_admin)):
    email = email.lower().strip()
    user = await db.auth_users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    restore_fields = {"is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()}
    for src, dst in [("pre_deactivation_status", "subscription_status"), ("pre_deactivation_tier", "subscription_tier"), ("pre_deactivation_plan", "plan_type")]:
        if user.get(src):
            restore_fields[dst] = user[src]
    result = await db.auth_users.update_one({"email": email}, {"$set": restore_fields})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found or already active")
    return {"status": "unarchived", "email": email, "restored_tier": user.get("pre_deactivation_tier"), "restored_status": user.get("pre_deactivation_status")}

@router.post("/admin/cancel-user/{email}")
async def cancel_user(email: str, _=Depends(require_admin)):
    email = email.lower().strip()
    result = await db.auth_users.update_one({"email": email}, {"$set": {"subscription_status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "cancelled", "email": email}

@router.post("/admin/restore-user/{email}")
async def restore_user(email: str, _=Depends(require_admin)):
    email = email.lower().strip()
    user = await db.auth_users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    restore_fields = {"subscription_status": "active", "is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()}
    if not user.get("is_active", True):
        for src, dst in [("pre_deactivation_tier", "subscription_tier"), ("pre_deactivation_plan", "plan_type")]:
            if user.get(src):
                restore_fields[dst] = user[src]
    result = await db.auth_users.update_one({"email": email}, {"$set": restore_fields})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "restored", "email": email}

@router.post("/admin/grant-lifetime/{email}")
async def grant_lifetime_access(email: str, _=Depends(require_admin)):
    email = email.lower().strip()
    user = await db.auth_users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    stripe_sub_id = user.get("stripe_subscription_id")
    stripe_cancelled = False
    if stripe_sub_id:
        try:
            stripe.Subscription.cancel(stripe_sub_id)
            stripe_cancelled = True
            logger.info(f"ADMIN: Cancelled Stripe subscription {stripe_sub_id} for {email}")
        except Exception as e:
            logger.warning(f"ADMIN: Could not cancel Stripe sub {stripe_sub_id} for {email}: {e}")
    await db.auth_users.update_one({"email": email}, {"$set": {"subscription_tier": "grandfathered", "plan_type": "grandfathered", "subscription_status": "active", "cancels_at": None, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"status": "granted", "email": email, "stripe_cancelled": stripe_cancelled}

# ── Stats ───────────────────────────────────────────────────────────

@router.get("/admin/stats")
async def get_admin_stats(_=Depends(require_admin)):
    total_users = await db.auth_users.count_documents({"is_active": True})
    trial_count = await db.auth_users.count_documents({"plan_type": "trial", "is_active": True})
    basic_count = await db.auth_users.count_documents({"subscription_tier": "basic", "subscription_status": {"$in": ["active", "cancelling"]}, "is_active": True})
    advanced_count = await db.auth_users.count_documents({"subscription_tier": "advanced", "subscription_status": {"$in": ["active", "cancelling"]}, "is_active": True})
    lifetime_count = await db.auth_users.count_documents({"subscription_tier": "grandfathered", "is_active": True})
    no_plan_count = await db.auth_users.count_documents({"$or": [{"subscription_status": None}, {"subscription_status": {"$exists": False}}], "is_active": True})
    cancelled_count = await db.auth_users.count_documents({"subscription_status": {"$in": ["cancelled", "cancelling"]}})
    deactivated_count = await db.auth_users.count_documents({"is_active": False})
    return {"users": {"total": total_users, "trial": trial_count, "basic": basic_count, "advanced": advanced_count, "lifetime": lifetime_count, "no_plan": no_plan_count, "cancelled": cancelled_count, "deactivated": deactivated_count}}

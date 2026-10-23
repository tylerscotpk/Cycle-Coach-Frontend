"""Account lifecycle routes: /api/account/undo-cancellation, /api/account/delete"""
from fastapi import APIRouter, HTTPException, Cookie, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from database import db
from routes.auth import hash_password
import hashlib
import logging
import stripe

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

BILLABLE_STATUSES = ("active", "trialing", "past_due", "unpaid")


async def _session_user(session_token, authorization):
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
    return user


def _iso(ts):
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else None


def _period_bounds(sub):
    try:
        item = sub["items"]["data"][0]
        return item.get("current_period_start"), item.get("current_period_end")
    except (KeyError, IndexError, TypeError, AttributeError):
        return sub.get("current_period_start"), sub.get("current_period_end")


# ========== UNDO CANCELLATION ==========

@router.post("/account/undo-cancellation")
async def undo_cancellation(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await _session_user(session_token, authorization)
    sub_id = user.get("stripe_subscription_id")
    if user.get("subscription_tier") == "grandfathered" or user.get("plan_type") == "grandfathered":
        raise HTTPException(status_code=400, detail="Lifetime accounts have no recurring subscription.")
    if not sub_id:
        raise HTTPException(status_code=400, detail="No subscription found to reinstate.")

    try:
        sub = stripe.Subscription.retrieve(sub_id)
    except stripe.StripeError as e:
        logger.error(f"UNDO CANCEL retrieve error for {user.get('email')}: {e}")
        raise HTTPException(status_code=409, detail="Could not reach the billing provider. Please try again.")

    _, period_end = _period_bounds(sub)
    now_ts = int(datetime.now(timezone.utc).timestamp())
    if sub.get("status") not in ("active", "trialing"):
        raise HTTPException(status_code=400, detail="This subscription has already ended. Please choose a plan to subscribe again.")
    if not sub.get("cancel_at_period_end") and not sub.get("cancel_at"):
        # Already renewing — repair local state if it drifted
        await db.auth_users.update_one({"id": user["id"]}, {"$set": {
            "subscription_status": sub.get("status"), "cancels_at": None,
            "updated_at": datetime.now(timezone.utc).isoformat()}})
        return {"success": True, "already_renewing": True, "subscription_status": sub.get("status")}
    if period_end and period_end <= now_ts:
        raise HTTPException(status_code=400, detail="This subscription period has ended. Please choose a plan to subscribe again.")

    try:
        params = {"cancel_at_period_end": False}
        if sub.get("cancel_at") and not sub.get("cancel_at_period_end"):
            params = {"cancel_at": ""}
        stripe.Subscription.modify(sub_id, **params)
        verified = stripe.Subscription.retrieve(sub_id)
    except stripe.StripeError as e:
        logger.error(f"UNDO CANCEL modify error for {user.get('email')}: {e}")
        raise HTTPException(status_code=409, detail="Could not restore your subscription. No changes were made.")

    if verified.get("cancel_at_period_end") or verified.get("cancel_at") or verified.get("status") not in ("active", "trialing"):
        raise HTTPException(status_code=409, detail="The billing provider did not confirm the change. Please refresh and check your status.")

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.auth_users.update_one({"id": user["id"]}, {"$set": {
        "subscription_status": verified.get("status"), "cancels_at": None, "updated_at": now_iso}})
    await db.license_keys.update_one({"stripe_subscription_id": sub_id}, {"$set": {
        "is_cancelled": False, "cancels_at": None, "updated_at": now_iso}})

    _, new_end = _period_bounds(verified)
    logger.info(f"UNDO CANCEL: {user.get('email')} sub={sub_id} renews={_iso(new_end)}")
    return {"success": True, "subscription_status": verified.get("status"), "renews_at": _iso(new_end)}


# ========== PERMANENT ACCOUNT DELETION ==========

class DeleteAccountRequest(BaseModel):
    password: str
    confirmation: str


def _invoice_payment_intent(invoice_id):
    payments = stripe.InvoicePayment.list(invoice=invoice_id, limit=5)
    for p in payments.data:
        pay = p.get("payment") or {}
        if p.get("status") == "paid" and pay.get("payment_intent"):
            return pay["payment_intent"]
    return None


def _refund_unused(sub):
    """Refund the unused portion of the current paid period. Idempotent per invoice."""
    if sub.get("status") == "trialing" or not sub.get("latest_invoice"):
        return None
    invoice = stripe.Invoice.retrieve(sub["latest_invoice"])
    paid = invoice.get("amount_paid") or 0
    start, end = _period_bounds(sub)
    now_ts = int(datetime.now(timezone.utc).timestamp())
    if paid <= 0 or not start or not end or end <= now_ts or end <= start:
        return None
    amount = int(paid * (end - now_ts) / (end - start))
    if amount < 50:
        return None
    pi = _invoice_payment_intent(invoice["id"])
    if not pi:
        return None
    refund = stripe.Refund.create(
        payment_intent=pi, amount=amount, reason="requested_by_customer",
        metadata={"reason": "account_deletion"},
        idempotency_key=f"cc-acctdel-refund-{invoice['id']}",
    )
    return {"refund_id": refund.get("id"), "amount": amount, "currency": invoice.get("currency")}


def _billable_subscriptions(user):
    subs, seen = [], set()
    customer_id = user.get("stripe_customer_id")
    if customer_id:
        for s in stripe.Subscription.list(customer=customer_id, status="all", limit=20).data:
            if s.get("status") in BILLABLE_STATUSES:
                subs.append(s)
                seen.add(s.get("id"))
    sub_id = user.get("stripe_subscription_id")
    if sub_id and sub_id not in seen:
        try:
            s = stripe.Subscription.retrieve(sub_id)
            if s.get("status") in BILLABLE_STATUSES:
                subs.append(s)
        except stripe.InvalidRequestError:
            pass
    return subs


async def _purge_user_records(user):
    uid, email = user["id"], (user.get("email") or "").lower()
    partner_ids = [p["id"] async for p in db.partner_profiles.find({"user_id": uid}, {"_id": 0, "id": 1})]
    if partner_ids:
        await db.cycle_history.delete_many({"partner_id": {"$in": partner_ids}})
    await db.partner_profiles.delete_many({"user_id": uid})
    await db.ai_conversations.delete_many({"user_id": uid})
    await db.user_resources.delete_many({"user_id": uid})
    await db.password_resets.delete_many({"user_id": uid})
    await db.deletion_requests.delete_many({"user_id": uid})
    if email:
        await db.trial_requests.delete_many({"email": email})
        await db.feedback.delete_many({"email": email})
        await db.license_keys.update_many({"customer_email": email}, {"$set": {
            "customer_email": None, "is_active": False, "anonymized": True}})
    await db.users.delete_many({"id": uid})
    await db.auth_users.delete_one({"id": uid})
    await db.user_sessions.delete_many({"user_id": uid})


@router.post("/account/delete")
async def delete_account(request: DeleteAccountRequest, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await _session_user(session_token, authorization)
    if request.confirmation.strip().upper() != "DELETE":
        raise HTTPException(status_code=400, detail='Please type DELETE to confirm.')
    if user.get("password_hash") != hash_password(request.password):
        raise HTTPException(status_code=401, detail="Incorrect password. Your account was not deleted.")

    cancelled, refunds = [], []
    if user.get("stripe_customer_id") or user.get("stripe_subscription_id"):
        try:
            for sub in _billable_subscriptions(user):
                r = _refund_unused(sub)
                if r:
                    refunds.append(r)
                stripe.Subscription.cancel(sub["id"], prorate=False, invoice_now=False)
                cancelled.append(sub["id"])
        except stripe.StripeError as e:
            logger.error(f"ACCOUNT DELETE billing step failed for user={user['id']}: {e}")
            raise HTTPException(status_code=409, detail=(
                "We could not stop your subscription billing, so your account was NOT deleted. "
                "Please try again in a moment or contact support."))

    # Minimal retained record: financial audit only, no email or personal data
    await db.account_deletions.insert_one({
        "user_ref": hashlib.sha256(user["id"].encode()).hexdigest(),
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "stripe_customer_id": user.get("stripe_customer_id"),
        "cancelled_subscriptions": cancelled,
        "refunds": refunds,
    })
    await _purge_user_records(user)
    logger.info(f"ACCOUNT DELETED: user_ref={hashlib.sha256(user['id'].encode()).hexdigest()[:12]} subs={len(cancelled)} refunds={len(refunds)}")
    return {
        "success": True,
        "cancelled_subscriptions": len(cancelled),
        "refunds": [{"amount": r["amount"], "currency": r["currency"]} for r in refunds],
    }

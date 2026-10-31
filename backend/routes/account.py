"""Account lifecycle routes: /api/account/undo-cancellation, /api/account/delete"""
from fastapi import APIRouter, HTTPException, Cookie, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from database import db
from routes.auth import hash_password
from routes.deletion_refunds import plan_refunds, record_plan, record_calc_failure, run_refund, public_status, store_followup_contact
from routes.deletion_email import send_deletion_email
import asyncio
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


_email_tasks = set()


def _plan_kind(user):
    if "grandfathered" in (user.get("plan_type"), user.get("subscription_tier")) or user.get("plan_type") == "lifetime":
        return "lifetime"
    if user.get("plan_type") == "trial" or user.get("subscription_status") == "trialing":
        return "trial"
    return "paid"


@router.post("/account/delete")
async def delete_account(request: DeleteAccountRequest, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await _session_user(session_token, authorization)
    if request.confirmation.strip().upper() != "DELETE":
        raise HTTPException(status_code=400, detail='Please type DELETE to confirm.')
    if user.get("password_hash") != hash_password(request.password):
        raise HTTPException(status_code=401, detail="Incorrect password. Your account was not deleted.")

    user_ref = hashlib.sha256(user["id"].encode()).hexdigest()
    customer_id = user.get("stripe_customer_id")
    as_of = int(datetime.now(timezone.utc).timestamp())
    cancelled, refund_docs = [], []
    if customer_id or user.get("stripe_subscription_id"):
        try:
            subs = _billable_subscriptions(user)
        except stripe.StripeError as e:
            logger.error(f"ACCOUNT DELETE could not list subscriptions for user_ref={user_ref[:12]}: {e}")
            raise HTTPException(status_code=409, detail=(
                "We could not confirm your subscription billing is stopped, so your account was NOT deleted yet. "
                "Please try again in a moment."))
        for sub in subs:
            planned = []
            if sub.get("status") != "trialing":
                try:
                    for item in plan_refunds(sub["id"], as_of):
                        planned.append(await record_plan(user_ref, customer_id, sub["id"], item, as_of))
                except stripe.StripeError as e:
                    planned.append(await record_calc_failure(user_ref, customer_id, sub["id"], as_of, str(e)[:200]))
            try:
                stripe.Subscription.cancel(sub["id"], prorate=False, invoice_now=False)
            except stripe.StripeError as e:
                if getattr(e, "code", None) != "resource_missing":
                    logger.error(f"ACCOUNT DELETE cancel failed sub={sub['id']}: {e}")
                    raise HTTPException(status_code=409, detail=(
                        "We could not stop your subscription billing, so your account was NOT deleted yet. "
                        "Please try again in a moment."))
            cancelled.append(sub["id"])
            # Billing is stopped; refunds never block deletion. Failures are recorded for resolution.
            for doc in planned:
                refund_docs.append(doc if doc["status"] == "needs_attention" else await run_refund(doc))

    # Resume any refund planned by an earlier interrupted attempt for this customer
    if customer_id:
        seen = {d["reference"] for d in refund_docs}
        async for doc in db.deletion_refunds.find({"stripe_customer_id": customer_id, "user_ref": user_ref,
                                                   "status": {"$in": ["planned", "needs_attention"]}}, {"_id": 0}):
            if doc["reference"] not in seen:
                refund_docs.append(doc if doc.get("invoice_id") is None else await run_refund(doc))

    # Minimal retained record: financial audit only, no email or personal data
    await db.account_deletions.insert_one({
        "user_ref": user_ref,
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "stripe_customer_id": customer_id,
        "cancelled_subscriptions": cancelled,
        "refund_references": [d["reference"] for d in refund_docs],
    })
    refunds = [public_status(d) for d in refund_docs]
    if user.get("email_verified"):
        # Encrypted address kept only for refunds Stripe hasn't confirmed yet, for the one follow-up email
        for r in refunds:
            if r["state"] in ("pending", "needs_attention"):
                await store_followup_contact(r["reference"], user.get("email"))
    await _purge_user_records(user)
    if user.get("email_verified"):
        # Fire-and-forget: deletion is already complete and never waits on the email service
        _email_tasks.add(t := asyncio.create_task(send_deletion_email(
            user.get("email"), _plan_kind(user), len(cancelled), refunds)))
        t.add_done_callback(_email_tasks.discard)
    logger.info(f"ACCOUNT DELETED: user_ref={user_ref[:12]} subs={len(cancelled)} refunds={[r['status'] for r in refunds]}")
    return {
        "success": True,
        "cancelled_subscriptions": len(cancelled),
        "refunds": refunds,
        "refund_needs_attention": any(r["state"] == "needs_attention" for r in refunds),
        "confirmation_email": bool(user.get("email_verified")),
    }

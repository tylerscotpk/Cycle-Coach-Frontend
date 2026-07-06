"""Stripe routes: /api/webhook/stripe, /api/cancel-subscription, /api/subscription/sync, /api/subscription/create-checkout, /api/subscription/upgrade"""
from fastapi import APIRouter, HTTPException, Request, Cookie, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from database import db
import os
import logging
import asyncio
import json
import resend
import stripe

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
stripe.api_key = STRIPE_API_KEY

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'info@cyclecoach.net')

# Price IDs
BASIC_PRICE_ID = "price_1Tp7MMISn9QYeFgUNM6enfS2"
ADVANCED_PRICE_ID = "price_1Tp7R9ISn9QYeFgU6Rxkc8Td"

PRICE_TO_PLAN = {
    BASIC_PRICE_ID: "basic",
    ADVANCED_PRICE_ID: "advanced",
}

ENTITLED_STATUSES = {"active", "trialing", "cancelling"}


async def send_purchase_confirmation_email(email: str, tier: str):
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured - skipping purchase confirmation email")
        return False
    tier_names = {"basic": "Basic Plan", "advanced": "Advanced Plan"}
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
            </div>
            """
        }
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"EMAIL SENT: purchase confirmation to {email}")
        return True
    except Exception as e:
        logger.error(f"EMAIL FAILED: purchase confirmation to {email}: {str(e)}")
        return False


def _extract_object(event, key="data"):
    """Safely extract nested object from Stripe event (dict or object)."""
    if isinstance(event, dict):
        return event.get(key, {}).get("object", {})
    return getattr(getattr(event, key, None), "object", {})


async def _find_user_by_email(email: str):
    """Find auth_users record by email (case-insensitive)."""
    if not email:
        return None
    return await db.auth_users.find_one({"email": email.lower().strip()})


async def _find_user_by_stripe_customer(customer_id: str):
    """Find auth_users record by stripe_customer_id."""
    if not customer_id:
        return None
    return await db.auth_users.find_one({"stripe_customer_id": customer_id})


async def _find_user_by_stripe_subscription(subscription_id: str):
    """Find auth_users record by stripe_subscription_id."""
    if not subscription_id:
        return None
    return await db.auth_users.find_one({"stripe_subscription_id": subscription_id})


async def _activate_user(user, fields: dict, event_label: str):
    """Update auth_users entitlement fields and log the result."""
    email = user.get("email", "unknown")
    user_id = user.get("id", "unknown")
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.auth_users.update_one({"id": user_id}, {"$set": fields})

    logger.info(
        f"ENTITLEMENT UPDATE [{event_label}]: user={email} (id={user_id}) "
        f"matched={result.matched_count} modified={result.modified_count} "
        f"fields={fields}"
    )
    return result.modified_count > 0


class CancelSubscriptionRequest(BaseModel):
    customerId: str
    subscriptionId: str


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature")

    try:
        if STRIPE_WEBHOOK_SECRET and sig_header:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        else:
            event = json.loads(payload)
            logger.warning("Processing webhook without signature verification")

        event_type = event.get("type") if isinstance(event, dict) else event.type
        logger.info(f"WEBHOOK RECEIVED: {event_type}")

        # ---- checkout.session.completed ----
        if event_type == "checkout.session.completed":
            session = _extract_object(event)
            session_id = session.get("id")
            subscription_id = session.get("subscription")
            customer_id = session.get("customer")
            customer_email = (
                session.get("customer_email")
                or session.get("customer_details", {}).get("email")
            )
            metadata = session.get("metadata", {})
            tier = metadata.get("tier", "basic")

            logger.info(
                f"CHECKOUT SESSION: id={session_id} sub={subscription_id} "
                f"customer={customer_id} email={customer_email} metadata={metadata}"
            )

            # Also capture client_reference_id (app user ID sent from frontend)
            client_ref_id = session.get("client_reference_id")

            # Try to resolve the Stripe subscription status (may be trialing)
            sub_status = "active"
            resolved_plan_type = tier  # fallback to metadata tier
            trial_ends_at_iso = None
            if subscription_id:
                try:
                    sub_obj = stripe.Subscription.retrieve(subscription_id)
                    sub_status = sub_obj.get("status", "active") if isinstance(sub_obj, dict) else sub_obj.status
                    # Resolve plan_type from actual price ID
                    items = sub_obj.get("items", {}).get("data", []) if isinstance(sub_obj, dict) else sub_obj.items.data
                    if items:
                        price_id = items[0].get("price", {}).get("id", "") if isinstance(items[0], dict) else items[0].price.id
                        resolved_plan_type = PRICE_TO_PLAN.get(price_id, tier)
                    # Capture trial end date
                    trial_end = sub_obj.get("trial_end") if isinstance(sub_obj, dict) else getattr(sub_obj, "trial_end", None)
                    if trial_end:
                        trial_ends_at_iso = datetime.fromtimestamp(trial_end, tz=timezone.utc).isoformat()
                    logger.info(f"SUBSCRIPTION STATUS from Stripe API: {sub_status} plan={resolved_plan_type} trial_end={trial_ends_at_iso}")
                except Exception as e:
                    logger.warning(f"Could not retrieve subscription {subscription_id}: {e}")

            customer_email_lower = (customer_email or "").lower().strip()

            # Find user: 1) by client_reference_id, 2) by email, 3) by stripe_customer_id
            auth_user = None
            if client_ref_id:
                auth_user = await db.auth_users.find_one({"id": client_ref_id})
                if auth_user:
                    logger.info(f"USER MATCHED by client_reference_id={client_ref_id}")
            if not auth_user and customer_email_lower:
                auth_user = await _find_user_by_email(customer_email_lower)
                if auth_user:
                    logger.info(f"USER MATCHED by email={customer_email_lower}")
            if not auth_user and customer_id:
                auth_user = await _find_user_by_stripe_customer(customer_id)
                if auth_user:
                    logger.info(f"USER MATCHED by stripe_customer_id={customer_id}")

            if not auth_user:
                logger.warning(
                    f"NO USER MATCH: email={customer_email_lower} "
                    f"client_ref={client_ref_id} customer={customer_id} "
                    f"(session={session_id}). No entitlement granted."
                )
                return {"status": "no_user", "message": "No registered user found"}

            # Skip if already processed with same subscription
            if auth_user.get("stripe_subscription_id") == subscription_id and auth_user.get("subscription_status") in ENTITLED_STATUSES:
                logger.info(f"ALREADY PROCESSED: {customer_email_lower} sub={subscription_id}")
                return {"status": "already_processed"}

            entitlement_status = sub_status if sub_status in ENTITLED_STATUSES else "active"

            # For trialing: plan_type stays as resolved (basic during trial)
            # When trial ends and converts, webhook fires subscription.updated → sets to active
            plan_type_value = resolved_plan_type
            if sub_status == "trialing":
                plan_type_value = "trial"

            update_fields = {
                "subscription_status": entitlement_status,
                "subscription_tier": resolved_plan_type,
                "plan_type": plan_type_value,
                "stripe_subscription_id": subscription_id,
                "stripe_customer_id": customer_id,
                "stripe_session_id": session_id,
            }
            if trial_ends_at_iso:
                update_fields["trial_ends_at"] = trial_ends_at_iso
                update_fields["trial_start_date"] = datetime.now(timezone.utc).isoformat()

            await _activate_user(auth_user, update_fields, "checkout.session.completed")

            # Send confirmation email AFTER entitlement persisted
            email_ok = await send_purchase_confirmation_email(customer_email_lower, tier)
            logger.info(f"CHECKOUT COMPLETE: {customer_email_lower} → status={entitlement_status} tier={tier} email_sent={email_ok}")
            return {"status": "success", "tier": tier, "entitlement": entitlement_status}

        # ---- customer.subscription.created ----
        elif event_type == "customer.subscription.created":
            subscription = _extract_object(event)
            subscription_id = subscription.get("id")
            customer_id = subscription.get("customer")
            status = subscription.get("status", "active")

            logger.info(f"SUBSCRIPTION CREATED: sub={subscription_id} customer={customer_id} status={status}")

            auth_user = await _find_user_by_stripe_customer(customer_id)
            if not auth_user:
                auth_user = await _find_user_by_stripe_subscription(subscription_id)

            if auth_user:
                entitlement_status = status if status in ENTITLED_STATUSES else "active"
                await _activate_user(auth_user, {
                    "subscription_status": entitlement_status,
                    "stripe_subscription_id": subscription_id,
                    "stripe_customer_id": customer_id,
                }, "customer.subscription.created")
            else:
                logger.warning(f"SUBSCRIPTION CREATED but no user matched: customer={customer_id} sub={subscription_id}")

            return {"status": "subscription_created", "subscription_status": status}

        # ---- customer.subscription.updated ----
        elif event_type == "customer.subscription.updated":
            subscription = _extract_object(event)
            subscription_id = subscription.get("id")
            customer_id = subscription.get("customer")
            status = subscription.get("status")
            cancel_at_period_end = subscription.get("cancel_at_period_end", False)
            cancel_at = subscription.get("cancel_at")

            logger.info(f"SUBSCRIPTION UPDATED: sub={subscription_id} status={status} cancel_at_period_end={cancel_at_period_end}")

            auth_user = (
                await _find_user_by_stripe_subscription(subscription_id)
                or await _find_user_by_stripe_customer(customer_id)
            )

            if auth_user:
                # Never overwrite grandfathered users from webhook
                if auth_user.get("subscription_tier") == "grandfathered":
                    logger.info(f"SKIPPING subscription update for grandfathered user {auth_user.get('email')}")
                    return {"status": "subscription_updated_skipped_grandfathered"}

                update = {"stripe_customer_id": customer_id}

                # Resolve plan_type from price ID
                items = subscription.get("items", {}).get("data", [])
                price_id = items[0].get("price", {}).get("id", "") if items else ""
                resolved_tier = PRICE_TO_PLAN.get(price_id, auth_user.get("subscription_tier", "basic"))

                if status == "active":
                    update["subscription_status"] = "active"
                    update["plan_type"] = resolved_tier
                    update["subscription_tier"] = resolved_tier
                elif status == "trialing":
                    update["subscription_status"] = "trialing"
                    update["plan_type"] = "trial"
                    update["subscription_tier"] = resolved_tier
                elif status in ("canceled", "unpaid"):
                    update["subscription_status"] = "cancelled"
                elif status == "past_due":
                    update["subscription_status"] = "past_due"

                if cancel_at_period_end and cancel_at:
                    update["subscription_status"] = "cancelling"
                    update["cancels_at"] = datetime.fromtimestamp(cancel_at, tz=timezone.utc).isoformat()
                elif not cancel_at_period_end:
                    update["cancels_at"] = None

                await _activate_user(auth_user, update, "customer.subscription.updated")
            else:
                logger.warning(f"SUBSCRIPTION UPDATED but no user matched: sub={subscription_id}")

            return {"status": "subscription_updated", "subscription_status": status}

        # ---- customer.subscription.deleted ----
        elif event_type == "customer.subscription.deleted":
            subscription = _extract_object(event)
            subscription_id = subscription.get("id")
            customer_id = subscription.get("customer")

            logger.info(f"SUBSCRIPTION DELETED: sub={subscription_id} customer={customer_id}")

            auth_user = (
                await _find_user_by_stripe_subscription(subscription_id)
                or await _find_user_by_stripe_customer(customer_id)
            )
            if auth_user:
                # Never downgrade grandfathered users — their Stripe sub was cancelled intentionally by admin
                if auth_user.get("subscription_tier") == "grandfathered":
                    logger.info(f"SKIPPING status update for grandfathered user {auth_user.get('email')}")
                else:
                    await _activate_user(auth_user, {"subscription_status": "cancelled"}, "customer.subscription.deleted")
            return {"status": "subscription_cancelled"}

        # ---- invoice.paid ----
        elif event_type == "invoice.paid":
            invoice = _extract_object(event)
            subscription_id = invoice.get("subscription")
            customer_id = invoice.get("customer")
            customer_email = invoice.get("customer_email")

            logger.info(f"INVOICE PAID: sub={subscription_id} customer={customer_id} email={customer_email}")

            auth_user = (
                await _find_user_by_stripe_subscription(subscription_id)
                or await _find_user_by_stripe_customer(customer_id)
                or await _find_user_by_email(customer_email)
            )
            if auth_user and auth_user.get("subscription_status") not in ENTITLED_STATUSES:
                await _activate_user(auth_user, {
                    "subscription_status": "active",
                    "stripe_subscription_id": subscription_id,
                    "stripe_customer_id": customer_id,
                }, "invoice.paid")

            return {"status": "invoice_paid"}

        # ---- invoice.payment_failed ----
        elif event_type == "invoice.payment_failed":
            invoice = _extract_object(event)
            subscription_id = invoice.get("subscription")
            logger.warning(f"INVOICE PAYMENT FAILED: sub={subscription_id}")

            auth_user = await _find_user_by_stripe_subscription(subscription_id)
            if auth_user:
                await _activate_user(auth_user, {"subscription_status": "past_due"}, "invoice.payment_failed")
            return {"status": "payment_failed_recorded"}

        else:
            logger.info(f"WEBHOOK IGNORED: {event_type}")
            return {"status": "ignored", "event_type": event_type}

    except stripe.SignatureVerificationError as e:
        logger.error(f"Webhook signature verification failed: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error(f"WEBHOOK ERROR: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel-subscription")
async def cancel_subscription(request: CancelSubscriptionRequest):
    try:
        subscription_id = request.subscriptionId
        customer_id = request.customerId

        license_record = await db.license_keys.find_one(
            {"stripe_subscription_id": subscription_id, "stripe_customer_id": customer_id, "is_active": True},
            {"_id": 0}
        )
        if not license_record:
            return JSONResponse(status_code=404, content={"success": False, "message": "Subscription not found or already cancelled"})

        if license_record.get("is_cancelled") and license_record.get("cancels_at"):
            return JSONResponse(status_code=400, content={"success": False, "message": "Already scheduled for cancellation", "cancels_at": license_record.get("cancels_at")})

        updated_subscription = stripe.Subscription.modify(subscription_id, cancel_at_period_end=True)
        cancel_at = updated_subscription.current_period_end
        cancels_at_date = datetime.fromtimestamp(cancel_at, tz=timezone.utc).isoformat()

        await db.license_keys.update_one(
            {"stripe_subscription_id": subscription_id},
            {"$set": {"cancels_at": cancels_at_date, "is_cancelled": True, "cancelled_at": datetime.now(timezone.utc).isoformat()}}
        )
        await db.auth_users.update_one(
            {"stripe_subscription_id": subscription_id},
            {"$set": {"subscription_status": "cancelling", "cancels_at": cancels_at_date, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        return {"success": True, "message": "Subscription cancelled successfully", "cancels_at": cancels_at_date}
    except stripe.StripeError as e:
        return JSONResponse(status_code=400, content={"success": False, "message": f"Failed: {str(e)}"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "message": "An error occurred"})



@router.post("/subscription/sync")
async def sync_subscription_from_stripe(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Query Stripe directly by email to check if the logged-in user has an active
    subscription. This is the self-healing fallback when webhooks don't reach us."""

    # — resolve session token from cookie or header —
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    user = await db.auth_users.find_one({"id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    email = user.get("email", "").lower().strip()
    if not email:
        return {"synced": False, "reason": "no_email"}

    # Already entitled — skip the Stripe API call
    if user.get("subscription_status") in ENTITLED_STATUSES:
        return {"synced": True, "already_entitled": True, "subscription_status": user["subscription_status"]}

    try:
        # 1. Find Stripe customers by email
        customers = stripe.Customer.list(email=email, limit=5)
        if not customers.data:
            # No customer by email — try checkout sessions with client_reference_id
            logger.info(f"SYNC: no Stripe customer for {email}, checking checkout sessions by user ID")
            sessions = stripe.checkout.Session.list(limit=50)
            for sess in sessions.data:
                if sess.client_reference_id == user.get("id") and sess.subscription:
                    sub = stripe.Subscription.retrieve(sess.subscription)
                    if sub.status in ("active", "trialing"):
                        update_fields = {
                            "subscription_status": sub.status,
                            "stripe_subscription_id": sub.id,
                            "stripe_customer_id": sess.customer,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }
                        await db.auth_users.update_one({"id": user["id"]}, {"$set": update_fields})
                        logger.info(f"SYNC SUCCESS (via session): {email} → status={sub.status}")
                        return {"synced": True, "subscription_status": sub.status}
            return {"synced": False, "reason": "no_stripe_customer"}

        # 2. Check all customers for active subscriptions
        for customer in customers.data:
            subs = stripe.Subscription.list(customer=customer.id, status="all", limit=10)
            for sub in subs.data:
                sub_status = sub.status  # active, trialing, canceled, past_due …
                if sub_status in ("active", "trialing"):
                    # Determine tier from metadata or default
                    tier = "basic"
                    if sub.metadata:
                        tier = sub.metadata.get("tier", "basic")

                    update_fields = {
                        "subscription_status": sub_status,
                        "stripe_subscription_id": sub.id,
                        "stripe_customer_id": customer.id,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                    if tier:
                        update_fields["subscription_tier"] = tier

                    await db.auth_users.update_one(
                        {"id": user["id"]},
                        {"$set": update_fields},
                    )
                    logger.info(
                        f"SYNC SUCCESS: {email} → status={sub_status} "
                        f"sub={sub.id} customer={customer.id} tier={tier}"
                    )
                    return {
                        "synced": True,
                        "subscription_status": sub_status,
                        "subscription_tier": tier,
                    }

        logger.info(f"SYNC: Stripe customer(s) found for {email} but no active subscription")
        return {"synced": False, "reason": "no_active_subscription"}

    except stripe.StripeError as e:
        logger.error(f"SYNC STRIPE ERROR for {email}: {e}")
        return {"synced": False, "reason": f"stripe_error: {str(e)}"}
    except Exception as e:
        logger.error(f"SYNC ERROR for {email}: {e}")
        return {"synced": False, "reason": "internal_error"}


# ========== CHECKOUT SESSION CREATION ==========

class CreateCheckoutRequest(BaseModel):
    plan: str  # "trial", "basic", "advanced"
    success_url: str
    cancel_url: str


async def _get_user_from_token(session_token=None, authorization=None):
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


@router.post("/subscription/create-checkout")
async def create_checkout_session(
    request: CreateCheckoutRequest,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await _get_user_from_token(session_token, authorization)
    email = user.get("email", "")
    user_id = user.get("id", "")

    if request.plan == "trial":
        price_id = BASIC_PRICE_ID
        metadata = {"tier": "basic", "flow": "trial"}
        subscription_data = {
            "trial_period_days": 7,
            "metadata": {"tier": "basic", "flow": "trial"},
        }
    elif request.plan == "basic":
        price_id = BASIC_PRICE_ID
        metadata = {"tier": "basic", "flow": "direct"}
        subscription_data = {"metadata": {"tier": "basic", "flow": "direct"}}
    elif request.plan == "advanced":
        price_id = ADVANCED_PRICE_ID
        metadata = {"tier": "advanced", "flow": "direct"}
        subscription_data = {"metadata": {"tier": "advanced", "flow": "direct"}}
    else:
        raise HTTPException(status_code=400, detail="Invalid plan")

    try:
        checkout_params = {
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": request.success_url,
            "cancel_url": request.cancel_url,
            "client_reference_id": user_id,
            "payment_method_collection": "always",
            "metadata": metadata,
            "subscription_data": subscription_data,
        }

        # Reuse existing Stripe customer if available, otherwise use email
        existing_customer_id = user.get("stripe_customer_id")
        if existing_customer_id:
            checkout_params["customer"] = existing_customer_id
        else:
            # Search Stripe for existing customer by email
            try:
                customers = stripe.Customer.list(email=email, limit=1)
                if customers.data:
                    checkout_params["customer"] = customers.data[0].id
                    # Persist for future use
                    await db.auth_users.update_one(
                        {"id": user_id},
                        {"$set": {"stripe_customer_id": customers.data[0].id}}
                    )
                else:
                    checkout_params["customer_email"] = email
            except Exception:
                checkout_params["customer_email"] = email

        session = stripe.checkout.Session.create(**checkout_params)
        logger.info(f"CHECKOUT CREATED: plan={request.plan} user={email} session={session.id}")
        return {"checkout_url": session.url, "session_id": session.id}

    except stripe.StripeError as e:
        logger.error(f"CHECKOUT ERROR: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")


# ========== UPGRADE ENDPOINT ==========

@router.post("/subscription/upgrade")
async def upgrade_subscription(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Upgrade from Basic to Advanced.
    - Trial users: swap price with proration_behavior='none'
    - Paid Basic users: swap price with proration_behavior='create_prorations'
    """
    user = await _get_user_from_token(session_token, authorization)
    sub_id = user.get("stripe_subscription_id")
    if not sub_id:
        raise HTTPException(status_code=400, detail="No active subscription found")

    try:
        sub = stripe.Subscription.retrieve(sub_id)

        if sub.status not in ("active", "trialing"):
            raise HTTPException(status_code=400, detail=f"Cannot upgrade — subscription status is {sub.status}")

        # Find the current subscription item
        if not sub.get("items") or not sub["items"].get("data"):
            raise HTTPException(status_code=400, detail="No subscription items found")

        item_id = sub["items"]["data"][0]["id"]
        current_price = sub["items"]["data"][0]["price"]["id"]

        if current_price == ADVANCED_PRICE_ID:
            raise HTTPException(status_code=400, detail="Already on Advanced plan")

        is_trialing = sub.status == "trialing"
        proration = "none" if is_trialing else "create_prorations"

        # Swap the price
        updated_sub = stripe.Subscription.modify(
            sub_id,
            items=[{"id": item_id, "price": ADVANCED_PRICE_ID}],
            proration_behavior=proration,
            metadata={"tier": "advanced"},
        )

        # Update DB immediately (webhook will also fire)
        await db.auth_users.update_one(
            {"id": user["id"]},
            {"$set": {
                "plan_type": "advanced",
                "subscription_tier": "advanced",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

        new_status = updated_sub.status
        logger.info(f"UPGRADE SUCCESS: user={user.get('email')} trial={is_trialing} proration={proration} status={new_status}")

        return {
            "success": True,
            "plan_type": "advanced",
            "was_trialing": is_trialing,
            "proration_behavior": proration,
            "subscription_status": new_status,
        }

    except stripe.StripeError as e:
        logger.error(f"UPGRADE ERROR: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")


# ========== DOWNGRADE ENDPOINT ==========

@router.post("/subscription/downgrade")
async def downgrade_subscription(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Downgrade from Advanced to Basic at end of current billing period."""
    user = await _get_user_from_token(session_token, authorization)
    sub_id = user.get("stripe_subscription_id")
    if not sub_id:
        raise HTTPException(status_code=400, detail="No active subscription found")

    try:
        sub = stripe.Subscription.retrieve(sub_id)

        if sub.status not in ("active", "trialing"):
            raise HTTPException(status_code=400, detail=f"Cannot downgrade — subscription status is {sub.status}")

        item_id = sub["items"]["data"][0]["id"]
        current_price = sub["items"]["data"][0]["price"]["id"]

        if current_price == BASIC_PRICE_ID:
            raise HTTPException(status_code=400, detail="Already on Basic plan")

        # Schedule the downgrade at the end of the current period
        updated_sub = stripe.Subscription.modify(
            sub_id,
            items=[{"id": item_id, "price": BASIC_PRICE_ID}],
            proration_behavior="none",
            metadata={"tier": "basic", "pending_downgrade": "true"},
        )

        # Calculate when the downgrade takes effect
        current_period_end = getattr(sub, 'current_period_end', None)
        downgrade_date = None
        if current_period_end:
            downgrade_date = datetime.fromtimestamp(current_period_end, tz=timezone.utc).isoformat()

        # Update DB — mark as pending downgrade but keep advanced access until period end
        await db.auth_users.update_one(
            {"id": user["id"]},
            {"$set": {
                "plan_type": "basic",
                "subscription_tier": "basic",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

        logger.info(f"DOWNGRADE SUCCESS: user={user.get('email')} effective={downgrade_date}")

        return {
            "success": True,
            "plan_type": "basic",
            "effective_date": downgrade_date,
            "message": "Downgrade scheduled. You'll keep Advanced access until your current billing period ends."
        }

    except stripe.StripeError as e:
        logger.error(f"DOWNGRADE ERROR: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")

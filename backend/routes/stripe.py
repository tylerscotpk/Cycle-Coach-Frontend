"""Stripe routes: /api/webhook/stripe, /api/cancel-subscription"""
from fastapi import APIRouter, HTTPException, Request
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

ENTITLED_STATUSES = {"active", "trialing", "cancelling"}


async def send_purchase_confirmation_email(email: str, tier: str):
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
            tier = metadata.get("tier", "monthly")

            logger.info(
                f"CHECKOUT SESSION: id={session_id} sub={subscription_id} "
                f"customer={customer_id} email={customer_email} metadata={metadata}"
            )

            # Try to resolve the Stripe subscription status (may be trialing)
            sub_status = "active"
            if subscription_id:
                try:
                    sub_obj = stripe.Subscription.retrieve(subscription_id)
                    sub_status = sub_obj.get("status", "active") if isinstance(sub_obj, dict) else sub_obj.status
                    logger.info(f"SUBSCRIPTION STATUS from Stripe API: {sub_status}")
                except Exception as e:
                    logger.warning(f"Could not retrieve subscription {subscription_id}: {e}")

            if not customer_email:
                logger.error(f"NO EMAIL in checkout session {session_id}")
                return {"status": "error", "message": "No customer email"}

            customer_email_lower = customer_email.lower().strip()

            # Find user: by email
            auth_user = await _find_user_by_email(customer_email_lower)
            if not auth_user:
                logger.warning(
                    f"NO USER MATCH for email={customer_email_lower} "
                    f"(session={session_id}). No entitlement granted."
                )
                return {"status": "no_user", "message": f"No registered user for {customer_email_lower}"}

            # Skip if already processed with same subscription
            if auth_user.get("stripe_subscription_id") == subscription_id and auth_user.get("subscription_status") in ENTITLED_STATUSES:
                logger.info(f"ALREADY PROCESSED: {customer_email_lower} sub={subscription_id}")
                return {"status": "already_processed"}

            entitlement_status = sub_status if sub_status in ENTITLED_STATUSES else "active"

            await _activate_user(auth_user, {
                "subscription_status": entitlement_status,
                "subscription_tier": tier,
                "stripe_subscription_id": subscription_id,
                "stripe_customer_id": customer_id,
                "stripe_session_id": session_id,
            }, "checkout.session.completed")

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
                update = {"stripe_customer_id": customer_id}
                if status == "active":
                    update["subscription_status"] = "active"
                elif status == "trialing":
                    update["subscription_status"] = "trialing"
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

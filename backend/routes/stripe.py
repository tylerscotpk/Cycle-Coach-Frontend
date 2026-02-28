"""Stripe routes: /api/webhook/stripe, /api/subscription/*, /api/cancel-subscription"""
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


# ============ HELPERS ============

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


# ============ REQUEST MODELS ============

class CreateCheckoutRequest(BaseModel):
    email: str
    tier: str = "basic"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None

class CancelSubscriptionRequest(BaseModel):
    customerId: str
    subscriptionId: str


# ============ ROUTES ============

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events for subscriptions"""
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature")

    try:
        if STRIPE_WEBHOOK_SECRET and sig_header:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        else:
            event = json.loads(payload)
            logger.warning("Processing webhook without signature verification")

        event_type = event.get("type") if isinstance(event, dict) else event.type
        logger.info(f"Received Stripe webhook: {event_type}")

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

            auth_user = await db.auth_users.find_one({"email": customer_email})
            if auth_user:
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
                asyncio.create_task(send_purchase_confirmation_email(customer_email, tier))
                return {"status": "success", "tier": tier}
            else:
                logger.warning(f"Webhook: No registered user found for {customer_email} (session {session_id}). Skipping.")
                return {"status": "no_user", "message": f"No registered user for {customer_email}"}

        elif event_type == "customer.subscription.deleted":
            subscription = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
            subscription_id = subscription.get("id")

            await db.license_keys.update_one(
                {"stripe_subscription_id": subscription_id},
                {"$set": {"is_active": False, "is_cancelled": True, "cancelled_at": datetime.now(timezone.utc).isoformat()}}
            )
            await db.auth_users.update_one(
                {"stripe_subscription_id": subscription_id},
                {"$set": {"subscription_status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            return {"status": "subscription_cancelled"}

        elif event_type == "customer.subscription.updated":
            subscription = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
            subscription_id = subscription.get("id")
            status = subscription.get("status")
            cancel_at_period_end = subscription.get("cancel_at_period_end", False)
            cancel_at = subscription.get("cancel_at")
            current_period_end = subscription.get("current_period_end")

            update_fields = {"subscription_status": status, "updated_at": datetime.now(timezone.utc).isoformat()}

            if cancel_at_period_end and cancel_at:
                cancels_at_date = datetime.fromtimestamp(cancel_at, tz=timezone.utc).isoformat()
                update_fields["cancels_at"] = cancels_at_date
                update_fields["is_cancelled"] = True
            elif not cancel_at_period_end:
                update_fields["cancels_at"] = None
                update_fields["is_cancelled"] = False

            if current_period_end:
                update_fields["expires_at"] = datetime.fromtimestamp(current_period_end, tz=timezone.utc).isoformat()

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

            await db.license_keys.update_one({"stripe_subscription_id": subscription_id}, {"$set": update_fields})

            auth_update = {"updated_at": datetime.now(timezone.utc).isoformat()}
            if status == "active":
                auth_update["subscription_status"] = "active"
            elif status in ("canceled", "unpaid"):
                auth_update["subscription_status"] = "cancelled"
            elif status == "past_due":
                auth_update["subscription_status"] = "past_due"

            await db.auth_users.update_one({"stripe_subscription_id": subscription_id}, {"$set": auth_update})
            return {"status": "subscription_updated", "subscription_status": status}

        elif event_type == "invoice.payment_failed":
            invoice = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
            subscription_id = invoice.get("subscription")
            logger.warning(f"Payment failed for subscription {subscription_id}")

            await db.license_keys.update_one(
                {"stripe_subscription_id": subscription_id},
                {"$set": {"payment_status": "past_due"}}
            )
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


@router.post("/cancel-subscription")
async def cancel_subscription(request: CancelSubscriptionRequest):
    """Cancel a user's subscription at the end of the billing period"""
    try:
        customer_id = request.customerId
        subscription_id = request.subscriptionId

        license_record = await db.license_keys.find_one(
            {"stripe_subscription_id": subscription_id, "stripe_customer_id": customer_id, "is_active": True},
            {"_id": 0}
        )

        if not license_record:
            return JSONResponse(status_code=404, content={"success": False, "message": "Subscription not found or already cancelled"})

        if license_record.get("is_cancelled") and license_record.get("cancels_at"):
            return JSONResponse(status_code=400, content={"success": False, "message": "Subscription is already scheduled for cancellation", "cancels_at": license_record.get("cancels_at")})

        try:
            updated_subscription = stripe.Subscription.modify(subscription_id, cancel_at_period_end=True)
            cancel_at = updated_subscription.current_period_end
            cancels_at_date = datetime.fromtimestamp(cancel_at, tz=timezone.utc).isoformat()

            await db.license_keys.update_one(
                {"stripe_subscription_id": subscription_id},
                {"$set": {"cancels_at": cancels_at_date, "is_cancelled": True, "cancelled_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            await db.auth_users.update_one(
                {"stripe_subscription_id": subscription_id},
                {"$set": {"subscription_status": "cancelling", "cancels_at": cancels_at_date, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )

            logger.info(f"Successfully cancelled subscription {subscription_id}, cancels at {cancels_at_date}")
            return {"success": True, "message": "Subscription cancelled successfully", "cancels_at": cancels_at_date}
        except stripe.StripeError as e:
            logger.error(f"Stripe error cancelling subscription: {str(e)}")
            return JSONResponse(status_code=400, content={"success": False, "message": f"Failed to cancel subscription: {str(e)}"})
    except Exception as e:
        logger.error(f"Error cancelling subscription: {str(e)}")
        return JSONResponse(status_code=500, content={"success": False, "message": "An error occurred while cancelling your subscription"})

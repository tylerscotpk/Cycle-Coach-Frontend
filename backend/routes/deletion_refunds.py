"""Prorated refunds for account deletion: planning, execution, failure records and admin resolution."""
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pymongo.errors import DuplicateKeyError
from typing import Optional
import hmac
from datetime import datetime, timezone
from database import db
from routes.admin import require_admin
import asyncio
import logging
import os
import uuid
import resend
import stripe
from cryptography.fernet import Fernet, InvalidToken
from datetime import timedelta
from routes.deletion_email import send_refund_followup_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

ACTIVE_REFUND_STATUSES = ("succeeded", "pending", "requires_action")
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'info@cyclecoach.net')
ADMIN_ALERT_EMAIL = "cyclecoach4men@gmail.com"


def _payment_intent(invoice_id):
    for p in stripe.InvoicePayment.list(invoice=invoice_id, limit=10).data:
        pay = p.get("payment") or {}
        if p.get("status") == "paid" and pay.get("payment_intent"):
            return pay["payment_intent"]
    return None


def _unused_paid_amount(invoice, as_of):
    """Unused share of what was actually paid on this invoice, measured line-by-line (handles prorations/discounts)."""
    paid = invoice.get("amount_paid") or 0
    lines = (invoice.get("lines") or {}).get("data") or []
    line_total = sum(l.get("amount") or 0 for l in lines)
    if paid <= 0 or line_total <= 0:
        return 0
    unused = 0.0
    for l in lines:
        period = l.get("period") or {}
        start, end = period.get("start"), period.get("end")
        if not start or not end or end <= start or end <= as_of:
            continue
        unused += (l.get("amount") or 0) * (end - max(as_of, start)) / (end - start)
    ratio = min(1.0, paid / line_total)
    return max(0, min(paid, int(unused * ratio)))


def plan_refunds(sub_id, as_of):
    """Return refund items for every paid invoice that still covers unused time. Read-only."""
    items = []
    for inv in stripe.Invoice.list(subscription=sub_id, status="paid", limit=24).data:
        unused = _unused_paid_amount(inv, as_of)
        if unused <= 0:
            continue
        items.append({"invoice_id": inv["id"], "currency": inv.get("currency"),
                      "amount_paid": inv.get("amount_paid"), "unused_amount": unused})
    return items


def _execute_refund(item):
    """Create (or find) the refund for one invoice. Never exceeds what remains refundable; never duplicates."""
    pi = item.get("payment_intent") or _payment_intent(item["invoice_id"])
    if not pi:
        raise LookupError("original payment not found for invoice")
    existing = stripe.Refund.list(payment_intent=pi, limit=100).data
    for r in existing:
        if (r.get("metadata") or {}).get("reason") == "account_deletion" and r.get("status") in ACTIVE_REFUND_STATUSES:
            return {"payment_intent": pi, "refund_id": r["id"], "amount": r.get("amount"), "stripe_status": r.get("status")}
    already = sum(r.get("amount") or 0 for r in existing if r.get("status") in ACTIVE_REFUND_STATUSES)
    amount = min(item["unused_amount"], (item.get("amount_paid") or 0) - already)
    if amount <= 0:
        return {"payment_intent": pi, "refund_id": None, "amount": 0, "stripe_status": None}
    refund = stripe.Refund.create(
        payment_intent=pi, amount=amount, reason="requested_by_customer",
        metadata={"reason": "account_deletion", "reference": item["reference"]},
        idempotency_key=f"cc-acctdel-refund-{item['invoice_id']}",
    )
    return {"payment_intent": pi, "refund_id": refund.get("id"), "amount": amount, "stripe_status": refund.get("status")}


async def record_plan(user_ref, customer_id, sub_id, item, as_of):
    """Persist the planned refund before billing is cancelled so it can always be resumed. One record per invoice."""
    now = datetime.now(timezone.utc).isoformat()
    doc = await db.deletion_refunds.find_one({"invoice_id": item["invoice_id"]}, {"_id": 0})
    if doc:
        return doc
    doc = {"reference": f"RF-{uuid.uuid4().hex[:10].upper()}", "user_ref": user_ref,
           "stripe_customer_id": customer_id, "subscription_id": sub_id, "as_of": as_of,
           "status": "planned", "created_at": now, "updated_at": now, **item}
    await db.deletion_refunds.insert_one(dict(doc))
    return doc


async def record_calc_failure(user_ref, customer_id, sub_id, as_of, error):
    now = datetime.now(timezone.utc).isoformat()
    doc = {"reference": f"RF-{uuid.uuid4().hex[:10].upper()}", "user_ref": user_ref, "stripe_customer_id": customer_id,
           "subscription_id": sub_id, "invoice_id": None, "as_of": as_of, "unused_amount": None, "currency": None,
           "status": "needs_attention", "error": f"calculation failed: {error}", "created_at": now, "updated_at": now}
    await db.deletion_refunds.insert_one(dict(doc))
    await _alert_admin(doc)
    return doc


async def run_refund(doc):
    """Attempt the refund for a stored record; update it to refunded / none_due / needs_attention."""
    if doc.get("status") == "refunded":
        doc = await refresh_refund_status(doc)
        await maybe_send_followup(doc)
        return doc
    if doc.get("status") in ("none_due", "resolved_manually", "resolved_by_recalculation"):
        return doc
    try:
        result = _execute_refund(doc)
        status = "refunded" if result["amount"] else "none_due"
        update = {"status": status, "payment_intent": result["payment_intent"], "refund_id": result["refund_id"],
                  "refunded_amount": result["amount"], "refund_stripe_status": result["stripe_status"], "error": None}
    except (stripe.StripeError, LookupError) as e:
        update = {"status": "needs_attention", "error": str(e)[:300]}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.deletion_refunds.update_one({"reference": doc["reference"]}, {"$set": update})
    doc = {**doc, **update}
    if doc["status"] == "needs_attention":
        logger.error(f"DELETION REFUND NEEDS ATTENTION ref={doc['reference']} invoice={doc.get('invoice_id')} err={doc['error']}")
        await _alert_admin(doc)
    await maybe_send_followup(doc)
    return doc


# ── Follow-up email contact (encrypted, expiring, deleted once used) ──

CONTACT_RETENTION_DAYS = 180


def _fernet():
    key = os.environ.get("REFUND_CONTACT_KEY")
    return Fernet(key.encode()) if key else None


async def store_followup_contact(reference, email):
    """Keep only an encrypted address, only for refunds not yet confirmed by Stripe."""
    f = _fernet()
    if not f or not email:
        logger.warning(f"Follow-up contact not stored for {reference} (REFUND_CONTACT_KEY missing or no email)")
        return False
    await db.refund_contacts.create_index("expires_at", expireAfterSeconds=0)
    await db.refund_contacts.update_one({"reference": reference}, {"$setOnInsert": {
        "reference": reference, "email_enc": f.encrypt(email.encode()).decode(),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=CONTACT_RETENTION_DAYS),
        "created_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return True


async def forget_contact(reference):
    await db.refund_contacts.delete_one({"reference": reference})


async def refresh_refund_status(doc):
    """Re-read a submitted refund from Stripe; only Stripe's 'succeeded' counts as issued."""
    if doc.get("status") != "refunded" or not doc.get("refund_id") or doc.get("refund_stripe_status") == "succeeded":
        return doc
    try:
        r = stripe.Refund.retrieve(doc["refund_id"])
    except stripe.StripeError as e:
        logger.warning(f"Refund status check failed ref={doc['reference']}: {e}")
        return doc
    update = {"refund_stripe_status": r.get("status"), "updated_at": datetime.now(timezone.utc).isoformat()}
    if r.get("status") in ("failed", "canceled"):
        update.update({"status": "needs_attention", "error": f"Stripe refund {r.get('status')}: {r.get('failure_reason')}"})
    await db.deletion_refunds.update_one({"reference": doc["reference"]}, {"$set": update})
    doc = {**doc, **update}
    if doc["status"] == "needs_attention":
        await _alert_admin(doc)
    return doc


async def maybe_send_followup(doc):
    """Email once, only after Stripe confirms the refund succeeded. Never touches the refund itself."""
    if refund_state(doc) != "issued":
        return False
    contact = await db.refund_contacts.find_one({"reference": doc["reference"]})
    if not contact:
        return False
    claim = await db.deletion_refunds.update_one(
        {"reference": doc["reference"], "followup_email_sent_at": None, "followup_claimed": {"$ne": True}},
        {"$set": {"followup_claimed": True}})
    if not claim.modified_count:
        return False
    try:
        email = _fernet().decrypt(contact["email_enc"].encode()).decode()
    except (InvalidToken, AttributeError):
        logger.error(f"Follow-up contact unreadable for {doc['reference']}")
        await db.deletion_refunds.update_one({"reference": doc["reference"]}, {"$set": {"followup_claimed": False}})
        return False
    amount = doc.get("refunded_amount") or doc.get("unused_amount")
    sent = await send_refund_followup_email(email, amount, doc.get("currency"), doc["reference"])
    if sent:
        await db.deletion_refunds.update_one({"reference": doc["reference"]}, {"$set": {
            "followup_email_sent_at": datetime.now(timezone.utc).isoformat()}})
        await forget_contact(doc["reference"])
    else:
        await db.deletion_refunds.update_one({"reference": doc["reference"]}, {"$set": {"followup_claimed": False}})
    return sent


async def process_open_refunds():
    """Check submitted-but-unconfirmed refunds and send any owed follow-up emails."""
    results = []
    async for doc in db.deletion_refunds.find({"status": "refunded", "followup_email_sent_at": None}, {"_id": 0}):
        if not await db.refund_contacts.find_one({"reference": doc["reference"]}, {"_id": 1}) and \
                doc.get("refund_stripe_status") == "succeeded":
            continue
        doc = await refresh_refund_status(doc)
        sent = await maybe_send_followup(doc)
        results.append({"reference": doc["reference"], "state": refund_state(doc), "followup_sent": sent})
    return results


async def handle_refund_webhook(refund_obj):
    doc = await db.deletion_refunds.find_one({"refund_id": refund_obj.get("id")}, {"_id": 0})
    if not doc:
        return False
    await db.deletion_refunds.update_one({"reference": doc["reference"]}, {"$set": {
        "refund_stripe_status": refund_obj.get("status"), "updated_at": datetime.now(timezone.utc).isoformat()}})
    doc = await refresh_refund_status({**doc, "refund_stripe_status": None})
    return await maybe_send_followup(doc)


async def _alert_admin(doc):
    if not RESEND_API_KEY:
        return
    try:
        resend.api_key = RESEND_API_KEY
        await asyncio.to_thread(resend.Emails.send, {
            "from": SENDER_EMAIL, "to": [ADMIN_ALERT_EMAIL],
            "subject": f"Action needed: account-deletion refund {doc['reference']}",
            "html": (f"<p>An automatic refund for a deleted account could not be completed.</p>"
                     f"<p>Reference: <b>{doc['reference']}</b><br>Stripe customer: {doc.get('stripe_customer_id')}<br>"
                     f"Invoice: {doc.get('invoice_id')}<br>Amount (cents): {doc.get('unused_amount')}<br>"
                     f"Error: {doc.get('error')}</p><p>Resolve from Admin → Deletion Refunds.</p>"),
        })
    except Exception as e:
        logger.error(f"Refund alert email failed for {doc['reference']}: {e}")


def refund_state(doc):
    """issued only when Stripe reports the refund succeeded; pending while Stripe is still processing."""
    if doc["status"] == "refunded":
        return "issued" if doc.get("refund_stripe_status") == "succeeded" else "pending"
    if doc["status"] in ("needs_attention", "planned"):
        return "needs_attention"
    return doc["status"]


def public_status(doc):
    return {"reference": doc["reference"], "status": doc["status"], "state": refund_state(doc),
            "amount": doc.get("refunded_amount") if doc["status"] == "refunded" else doc.get("unused_amount"),
            "currency": doc.get("currency")}


# ── Admin resolution ────────────────────────────────────────────────

@router.get("/admin/deletion-refunds")
async def list_deletion_refunds(status: str = "open", _: bool = Depends(require_admin)):
    if status == "open":
        query = {"$or": [{"status": "needs_attention"},
                         {"status": "refunded", "refund_stripe_status": {"$ne": "succeeded"}}]}
    else:
        query = {} if status == "all" else {"status": status}
    return await db.deletion_refunds.find(query, {"_id": 0, "user_ref": 0}).sort("created_at", -1).to_list(200)


@router.post("/admin/deletion-refunds/check-pending")
async def check_pending_deletion_refunds(_: bool = Depends(require_admin)):
    return {"results": await process_open_refunds()}


@router.post("/admin/deletion-refunds/{reference}/retry")
async def retry_deletion_refund(reference: str, _: bool = Depends(require_admin)):
    doc = await db.deletion_refunds.find_one({"reference": reference}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Refund record not found")
    if doc.get("invoice_id") is None:
        # Calculation never succeeded: recompute against the original deletion time
        try:
            items = plan_refunds(doc["subscription_id"], doc["as_of"])
        except stripe.StripeError as e:
            raise HTTPException(status_code=409, detail=f"Stripe unavailable: {e}")
        results = []
        contact = await db.refund_contacts.find_one({"reference": reference}, {"_id": 0})
        for item in items:
            planned = await record_plan(doc["user_ref"], doc["stripe_customer_id"], doc["subscription_id"], item, doc["as_of"])
            if contact:
                await db.refund_contacts.update_one({"reference": planned["reference"]}, {"$setOnInsert": {
                    **contact, "reference": planned["reference"]}}, upsert=True)
            results.append(public_status(await run_refund(planned)))
        await forget_contact(reference)
        await db.deletion_refunds.update_one({"reference": reference}, {"$set": {
            "status": "resolved_by_recalculation", "updated_at": datetime.now(timezone.utc).isoformat()}})
        return {"reference": reference, "results": results}
    return public_status(await run_refund(doc))


@router.post("/admin/deletion-refunds/{reference}/mark-resolved")
async def mark_deletion_refund_resolved(reference: str, _: bool = Depends(require_admin)):
    res = await db.deletion_refunds.update_one({"reference": reference}, {"$set": {
        "status": "resolved_manually", "updated_at": datetime.now(timezone.utc).isoformat()}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Refund record not found")
    await forget_contact(reference)  # resolved outside our system: no Stripe confirmation, so no automated email
    return {"reference": reference, "status": "resolved_manually"}


# ── Daily scheduled check (platform cron) ──────────────────────────

_cron_tasks = set()


async def daily_refund_check(run_id):
    """Status checks + follow-up emails only. Never creates or retries refunds."""
    now = datetime.now(timezone.utc)
    try:
        # Single-runner lock: upsert fails with DuplicateKeyError while another run holds it
        await db.cron_locks.find_one_and_update(
            {"_id": "refund-check", "$or": [{"locked_until": None}, {"locked_until": {"$lt": now}}]},
            {"$set": {"locked_until": now + timedelta(minutes=30), "run_id": run_id}}, upsert=True)
    except DuplicateKeyError:
        await db.cron_runs.update_one({"run_id": run_id}, {"$set": {"status": "skipped_locked"}})
        return
    try:
        results = await process_open_refunds()
        summary = {"status": "completed", "checked": len(results),
                   "followups_sent": sum(1 for r in results if r["followup_sent"]),
                   "flagged": sum(1 for r in results if r["state"] == "needs_attention")}
    except Exception as e:
        logger.error(f"DAILY REFUND CHECK failed run={run_id}: {e}", exc_info=True)
        summary = {"status": "failed", "error": str(e)[:300]}
    finally:
        await db.cron_locks.update_one({"_id": "refund-check"}, {"$set": {"locked_until": None}})
    summary["finished_at"] = datetime.now(timezone.utc).isoformat()
    await db.cron_runs.update_one({"run_id": run_id}, {"$set": summary})
    logger.info(f"DAILY REFUND CHECK run={run_id} {summary}")


@router.post("/cron/refund-check", status_code=202)
async def cron_refund_check(request: Request, authorization: Optional[str] = Header(None),
                            x_webhook_id: Optional[str] = Header(None)):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    token = authorization[7:] if authorization and authorization.startswith("Bearer ") else ""
    if not secret or not token or not hmac.compare_digest(token.encode(), secret.encode()):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        envelope = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid body")
    if not isinstance(envelope, dict):
        raise HTTPException(status_code=400, detail="Invalid body")
    run_id = x_webhook_id or envelope.get("run_id")
    if not run_id:
        raise HTTPException(status_code=400, detail="Missing run id")
    await db.cron_runs.create_index("run_id", unique=True)
    try:
        await db.cron_runs.insert_one({"run_id": run_id, "job": "refund-check", "status": "queued",
                                       "queued_at": datetime.now(timezone.utc).isoformat()})
    except DuplicateKeyError:
        return {"accepted": True, "duplicate": True}
    _cron_tasks.add(t := asyncio.create_task(daily_refund_check(run_id)))
    t.add_done_callback(_cron_tasks.discard)
    return {"accepted": True}


@router.get("/admin/deletion-refunds/last-check")
async def last_refund_check(_: bool = Depends(require_admin)):
    run = await db.cron_runs.find_one({"job": "refund-check", "finished_at": {"$exists": True}},
                                      {"_id": 0}, sort=[("finished_at", -1)])
    return run or {}

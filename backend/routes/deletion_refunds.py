"""Prorated refunds for account deletion: planning, execution, failure records and admin resolution."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from database import db
from routes.admin import require_admin
import asyncio
import logging
import os
import uuid
import resend
import stripe

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
            return {"payment_intent": pi, "refund_id": r["id"], "amount": r.get("amount")}
    already = sum(r.get("amount") or 0 for r in existing if r.get("status") in ACTIVE_REFUND_STATUSES)
    amount = min(item["unused_amount"], (item.get("amount_paid") or 0) - already)
    if amount <= 0:
        return {"payment_intent": pi, "refund_id": None, "amount": 0}
    refund = stripe.Refund.create(
        payment_intent=pi, amount=amount, reason="requested_by_customer",
        metadata={"reason": "account_deletion", "reference": item["reference"]},
        idempotency_key=f"cc-acctdel-refund-{item['invoice_id']}",
    )
    return {"payment_intent": pi, "refund_id": refund.get("id"), "amount": amount}


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
    if doc.get("status") in ("refunded", "none_due", "resolved_manually", "resolved_by_recalculation"):
        return doc
    try:
        result = _execute_refund(doc)
        status = "refunded" if result["amount"] else "none_due"
        update = {"status": status, "payment_intent": result["payment_intent"], "refund_id": result["refund_id"],
                  "refunded_amount": result["amount"], "error": None}
    except (stripe.StripeError, LookupError) as e:
        update = {"status": "needs_attention", "error": str(e)[:300]}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.deletion_refunds.update_one({"reference": doc["reference"]}, {"$set": update})
    doc = {**doc, **update}
    if doc["status"] == "needs_attention":
        logger.error(f"DELETION REFUND NEEDS ATTENTION ref={doc['reference']} invoice={doc.get('invoice_id')} err={doc['error']}")
        await _alert_admin(doc)
    return doc


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


def public_status(doc):
    return {"reference": doc["reference"], "status": doc["status"],
            "amount": doc.get("refunded_amount") if doc["status"] == "refunded" else doc.get("unused_amount"),
            "currency": doc.get("currency")}


# ── Admin resolution ────────────────────────────────────────────────

@router.get("/admin/deletion-refunds")
async def list_deletion_refunds(status: str = "needs_attention", _: bool = Depends(require_admin)):
    query = {} if status == "all" else {"status": status}
    return await db.deletion_refunds.find(query, {"_id": 0, "user_ref": 0}).sort("created_at", -1).to_list(200)


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
        for item in items:
            planned = await record_plan(doc["user_ref"], doc["stripe_customer_id"], doc["subscription_id"], item, doc["as_of"])
            results.append(public_status(await run_refund(planned)))
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
    return {"reference": reference, "status": "resolved_manually"}

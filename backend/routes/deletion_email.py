"""Account-deletion confirmation email (Resend, existing provider). Contains no cycle, partner or history data."""
import asyncio
import html
import logging
import os
import resend

logger = logging.getLogger(__name__)

SUPPORT_EMAIL = "cyclecoach4men@gmail.com"


def _money(cents, currency):
    if not isinstance(cents, int):
        return "the unused amount"
    return f"${cents / 100:,.2f}" if (currency or "usd").lower() == "usd" else f"{cents / 100:,.2f} {currency.upper()}"


def billing_line(plan_kind, cancelled_count):
    if plan_kind == "lifetime":
        return "Your Lifetime access has ended. Lifetime accounts have no recurring billing, so there is nothing further to stop."
    if cancelled_count:
        if plan_kind == "trial":
            return "Your free trial was cancelled. You will not be charged."
        return "Your recurring subscription was cancelled. No future subscription charges will be made."
    return "You had no active recurring subscription, so there was no billing to stop."


_STATE_TEXT = {
    "issued": "Issued — Stripe has confirmed this refund to your original payment method. It may take 5–10 business days to appear.",
    "pending": "Pending — the refund has been submitted and Stripe is still processing it. We'll make sure it completes.",
    "needs_attention": f"Needs attention — this refund could not be processed automatically. Our team has been notified and will complete it. Questions? Email {SUPPORT_EMAIL} and quote the reference.",
}


def build_email(plan_kind, cancelled_count, refunds):
    rows = ""
    for r in refunds:
        if r.get("state") not in _STATE_TEXT:
            continue
        rows += (f"<tr><td style='padding:8px 0;'><b>{html.escape(_money(r.get('amount'), r.get('currency')))}</b> refund<br>"
                 f"Status: {html.escape(_STATE_TEXT[r['state']])}<br>"
                 f"Reference: <code>{html.escape(r['reference'])}</code></td></tr>")
    refund_html = (f"<h3 style='margin:20px 0 4px;'>Prorated refund</h3><table>{rows}</table>" if rows
                   else "<p>No refund was due for this account.</p>")
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #0f172a; color: white; padding: 24px; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">Your Cycle Coach account was deleted</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 10px 10px; color: #0f172a;">
        <p>This confirms your Cycle Coach account has been <b>permanently deleted</b>, along with the account records on our servers.</p>
        <p>{html.escape(billing_line(plan_kind, cancelled_count))}</p>
        {refund_html}
        <p style="margin-top: 20px;">Need help with a refund or this deletion? Contact us at
          <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>{' and include your refund reference' if rows else ''}.</p>
        <p style="color: #64748b; font-size: 12px; margin-top: 24px;">Only the minimum billing records required by law are retained. If you didn't request this deletion, contact us right away.</p>
        <p style="color: #64748b; font-size: 12px;">Cycle Coach — Stars &amp; Honey, LLC</p>
      </div>
    </div>"""


async def send_deletion_email(email, plan_kind, cancelled_count, refunds):
    """Best effort; never raises. The address is used only for this send and is not stored."""
    api_key = os.environ.get("RESEND_API_KEY", "")
    if not api_key or not email:
        logger.warning("Deletion confirmation email skipped (email service not configured or no address)")
        return False
    try:
        resend.api_key = api_key
        await asyncio.to_thread(resend.Emails.send, {
            "from": os.environ.get("SENDER_EMAIL", "info@cyclecoach.net"),
            "to": [email],
            "subject": "Your Cycle Coach account has been deleted",
            "html": build_email(plan_kind, cancelled_count, refunds),
        })
        logger.info("Deletion confirmation email sent")
        return True
    except Exception as e:
        logger.error(f"Deletion confirmation email failed: {e}")
        return False

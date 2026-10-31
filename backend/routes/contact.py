"""Contact form route."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import logging
import asyncio
import resend

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
CONTACT_EMAIL = "cyclecoach4men@gmail.com"

class ContactRequest(BaseModel):
    name: str = "Anonymous"
    email: str
    message: str

@router.post("/contact")
async def submit_contact(request: ContactRequest):
    if not request.email or not request.message:
        raise HTTPException(status_code=400, detail="Email and message are required")
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Email service not configured")
    try:
        params = {
            "from": "Cycle Coach <noreply@cyclecoach.net>",
            "to": [CONTACT_EMAIL],
            "subject": f"Cycle Coach Contact Form - {request.name}",
            "html": f"""<div style="font-family:Arial;max-width:600px;margin:auto">
                <h2 style="color:#0891b2">New Contact Form Submission</h2>
                <div style="background:#f1f5f9;padding:20px;border-radius:8px;margin:20px 0">
                    <p><strong>From:</strong> {request.name}</p>
                    <p><strong>Email:</strong> {request.email}</p>
                    <p><strong>Message:</strong></p>
                    <p style="white-space:pre-wrap;background:white;padding:15px;border-radius:4px">{request.message}</p>
                </div>
                <p style="color:#64748b;font-size:12px">Submitted via Cycle Coach contact form</p>
            </div>""",
            "reply_to": request.email,
        }
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Contact form email sent: {email_result}")
        return {"success": True, "message": "Message sent successfully"}
    except Exception as e:
        logger.error(f"Error sending contact form: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message")

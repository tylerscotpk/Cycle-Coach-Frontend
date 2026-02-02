# Cycle Coach - Product Requirements Document

## Original Problem Statement
Create a mobile-friendly web app called "Cycle Coach" to help men understand their partners' menstrual cycles. The app tracks cycles, provides phase-based tips and research-backed insights, and features an "AI Wingman" for personalized advice.

## Core Requirements
- **Cycle Tracking:** Track cycles, provide phase-based tips, display research-backed facts
- **Privacy-First:** All personal cycle data stored locally in browser `localStorage`
- **AI Wingman:** Anonymously provide AI-driven advice using partner profile context
- **Monetization:** Stripe Payment Links subscription model with webhooks
- **Admin Dashboard:** Password-protected portal for user/subscription management
- **Push Notifications:** Phase reminders and reflection prompts
- **Contact Page:** Form to send messages to admin email
- **Account Page:** View subscription status and cancel subscription
- **Phase Predictor:** Predict cycle phase for any given date

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI, Capacitor (native builds)
- **Backend:** FastAPI, MongoDB
- **Data Storage:** Browser `localStorage` for cycle data, MongoDB for licensing
- **Integrations:** Stripe (payments), Resend (emails), OpenAI GPT (AI Wingman via Emergent LLM Key)

## Architecture
```
/app/
├── backend/
│   ├── .env                    # Environment variables (Mongo, Stripe, Resend, Admin password)
│   ├── requirements.txt
│   └── server.py               # FastAPI: AI proxy, license/webhook, admin auth, contact APIs
├── frontend/
│   ├── .env                    # REACT_APP_BACKEND_URL
│   ├── capacitor.config.json
│   ├── package.json
│   └── src/
│       ├── App.js              # Main router
│       ├── components/
│       │   ├── Paywall.jsx     # Subscription plans
│       │   └── NotificationSettings.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── AdminDashboard.jsx
│       │   ├── PrivacySettings.jsx
│       │   ├── AccountSettings.jsx
│       │   ├── Contact.jsx
│       │   └── PhasePredictor.jsx
│       └── utils/
│           ├── localStorageManager.js
│           ├── resourcesData.js
│           └── notificationService.js
```

## Subscription Tiers
- **Monthly Training Plan:** $3.99/mo (7-day free trial)
- **Quarter by Quarter:** $10.49/3 months
- **Full Season Strategy:** $35.91/year

## Admin Access
- **URL:** `/admin`
- **Password:** Stored in `backend/.env` as `ADMIN_PASSWORD`
- **Authentication:** Backend-validated via `/api/admin/login` endpoint

---

## Changelog

### 2025-02-01 - Security Fix
- **Fixed:** Moved hardcoded admin password from frontend to backend environment variable
- **Added:** Backend admin authentication endpoints (`/api/admin/login`, `/api/admin/verify`, `/api/admin/logout`)
- **Added:** Admin session management in MongoDB with 24-hour token expiry
- **Updated:** Frontend `AdminDashboard.jsx` to use backend authentication

### Previous Session Completed Work
- AI Wingman with partner profile context
- Push notification system
- Admin dashboard with subscription tier filtering
- Resources overhaul with phase-tagging
- Account Settings page with subscription management
- Subscription cancellation flow
- Contact page with Resend email integration
- Phase Predictor feature
- UI/Layout fixes for Paywall and Dashboard

---

## Backlog

### P0 - Critical (Deployment Blockers)
- [ ] Move hardcoded Stripe Payment Links to frontend env variables
- [ ] Revert hardcoded backend URL to use `REACT_APP_BACKEND_URL`

### P1 - High Priority
- [ ] Complete App Store deployment with Capacitor
- [ ] Add supervisor config for production deployment

### P2 - Medium Priority
- [ ] Refactor `backend/server.py` - cleanup deprecated code
- [ ] Refactor `Dashboard.jsx` - break into smaller components

### P3 - Future Enhancements
- [ ] Additional notification triggers
- [ ] Analytics dashboard improvements
- [ ] Multi-partner support

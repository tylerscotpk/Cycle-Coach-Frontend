# Cycle Coach - Product Requirements Document

## Original Problem Statement
Create a mobile-friendly web app called "Cycle Coach" to help men understand their partners' menstrual cycles. The app tracks cycles, provides phase-based tips and research-backed insights, and features an "AI Wingman" for personalized advice. Includes a public-facing informational website and subscription-based monetization.

## Core Requirements
- **Cycle Tracking:** Track cycles, provide phase-based tips, display research-backed facts
- **Privacy-First:** All personal cycle data stored locally in browser `localStorage`
- **AI Wingman:** Anonymously provide AI-driven advice using partner profile context
- **Authentication:** Email/password sign-up and login with JWT sessions
- **Subscription Routing:** Public visitors see marketing pages; subscribed users access /app; non-subscribed users see pricing
- **Monetization:** Stripe Payment Links subscription model with webhooks
- **Admin Dashboard:** Password-protected portal for user/subscription management
- **Contact Page:** Form to send messages to admin email
- **Account Page:** View subscription status and cancel subscription
- **Phase Predictor:** Predict cycle phase for any given date

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI, Capacitor (native builds)
- **Backend:** FastAPI, MongoDB
- **Data Storage:** Browser `localStorage` for cycle data, MongoDB for users/subscriptions
- **Integrations:** Stripe (payments), Resend (emails), OpenAI GPT (AI Wingman via Emergent LLM Key)

## Architecture
```
/app/
├── backend/
│   ├── .env
│   ├── requirements.txt
│   └── server.py               # FastAPI: auth, subscriptions, webhooks, AI, admin
├── frontend/
│   ├── .env
│   ├── package.json
│   └── src/
│       ├── App.js              # Routing + AuthContext (public vs private)
│       ├── components/
│       │   ├── InfoNav.jsx     # Public website navigation
│       │   └── ui/             # Shadcn UI components
│       ├── pages/
│       │   ├── InfoHome.jsx        # Public landing page
│       │   ├── InfoAbout.jsx       # Public about page (center-aligned)
│       │   ├── InfoPricing.jsx     # Pricing with Stripe Payment Links ($3/$8/$30)
│       │   ├── InfoContact.jsx     # Contact form
│       │   ├── InfoLogin.jsx       # Email/password login
│       │   ├── InfoSignUp.jsx      # User registration
│       │   ├── InfoForgotPassword.jsx  # Password reset request
│       │   ├── InfoResetPassword.jsx   # Password reset form
│       │   ├── Dashboard.jsx       # Main app dashboard (subscribed users)
│       │   ├── AccountSettings.jsx # Subscription management (API-driven)
│       │   ├── AdminDashboard.jsx  # Admin portal
│       │   └── PhasePredictor.jsx  # Cycle phase predictor
│       └── utils/
│           └── localStorageManager.js
```

## Subscription Tiers
- **Monthly Training Plan:** $3/mo
- **Quarter by Quarter:** $8/3 months (Free 14-Day Trial)
- **Full Season Strategy:** $30/year (Best Value)

## Database Collections
- **`auth_users`:** Email/password users with subscription status (primary user store)
- **`user_sessions`:** Session tokens for authentication
- **`password_resets`:** Password reset tokens (1hr expiry)
- **`license_keys`:** Legacy collection (kept for backward compat with Stripe webhooks)
- **`admin_sessions`:** Admin authentication tokens

## Key API Endpoints
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/check` - Check auth + subscription status
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/account/subscription` - Get subscription details
- `POST /api/account/cancel-subscription` - Cancel subscription
- `POST /api/webhook/stripe` - Handle Stripe events (syncs to auth_users)

## Admin Access
- **URL:** `/admin`
- **Password:** Stored in `backend/.env` as `ADMIN_PASSWORD`

---

## What's Been Implemented

### Feb 27, 2026 - Auth System Finalized & Database Sync
- **Fixed:** Stripe webhook now syncs subscription_status to `auth_users` collection
- **Added:** `GET /api/account/subscription` endpoint for authenticated subscription data
- **Added:** `POST /api/account/cancel-subscription` endpoint (session-based auth)
- **Updated:** AccountSettings.jsx fetches data from API instead of localStorage
- **Fixed:** `send_subscription_email` tier config fallback bug (KeyError: 'basic')
- **Fixed:** `resend.emails.send` capitalization to `resend.Emails.send`
- **Fixed:** About page center-aligned (text-left → text-center on resource items)
- **Fixed:** Placeholder text on home page hero section
- **Result:** Full auth lifecycle works: Register → Pay via Stripe → Webhook syncs → User accesses /app

### Previous Session Work
- Authentication overhaul from license-keys to email/password
- Informational website (Home, About, Pricing, Contact pages)
- Stripe Payment Links integration
- Subscription cancellation flow
- Admin dashboard with backend auth
- AI Wingman, Phase Predictor, Push Notifications
- Resources system with bookmarking

---

## Backlog

### P1 - High Priority
- [ ] Refactor `backend/server.py` into modular router files (auth.py, stripe.py, admin.py)
- [ ] Fix Contact Form (Resend domain verification needed by user)

### P2 - Medium Priority
- [ ] Refactor `Dashboard.jsx` into smaller components
- [ ] Clean up legacy `license_keys` references in admin dashboard
- [ ] Complete App Store deployment with Capacitor

### P3 - Future Enhancements
- [ ] Additional notification triggers
- [ ] Analytics dashboard improvements
- [ ] Multi-partner support

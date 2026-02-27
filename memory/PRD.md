# Cycle Coach - Product Requirements Document

## Original Problem Statement
Create a mobile-friendly web app called "Cycle Coach" to help men understand their partners' menstrual cycles. The app tracks cycles, provides phase-based tips and research-backed insights, and features an "AI Wingman" for personalized advice. Includes a public-facing informational website and subscription-based monetization.

## Core Requirements
- **Cycle Tracking:** Track cycles, provide phase-based tips, display research-backed facts
- **Privacy-First:** All personal cycle data stored locally in browser `localStorage`
- **AI Wingman:** Anonymously provide AI-driven advice using partner profile context
- **Authentication:** Email/password sign-up and login with JWT sessions
- **Account-First Purchase Flow:** Users must create an account before purchasing a subscription
- **Subscription Routing:** Public visitors see marketing pages; subscribed users access /app; non-subscribed users see pricing
- **Monetization:** Stripe Payment Links subscription model with webhooks
- **Emails:** Welcome email on signup, purchase confirmation on Stripe checkout (via Resend)
- **Admin Dashboard:** Password-protected portal for user management (reads from auth_users)
- **Contact Page:** Form to send messages to admin email

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI, Capacitor (native builds)
- **Backend:** FastAPI, MongoDB
- **Data Storage:** Browser `localStorage` for cycle data, MongoDB `auth_users` for users/subscriptions
- **Integrations:** Stripe (payments), Resend (emails), OpenAI GPT (AI Wingman)

## Architecture
```
/app/
├── backend/
│   ├── .env
│   ├── requirements.txt
│   └── server.py
├── frontend/
│   ├── .env
│   ├── package.json
│   └── src/
│       ├── App.js              # Routing + AuthContext + subscription polling
│       ├── components/
│       │   ├── InfoNav.jsx     # Conditional nav (auth-aware)
│       │   └── ui/             # Shadcn UI components
│       ├── pages/
│       │   ├── InfoHome.jsx
│       │   ├── InfoAbout.jsx
│       │   ├── InfoPricing.jsx     # Account-first: redirects to signup if not logged in
│       │   ├── InfoContact.jsx
│       │   ├── InfoLogin.jsx       # Handles pending plan redirect
│       │   ├── InfoSignUp.jsx      # Handles pending plan → Stripe redirect
│       │   ├── InfoForgotPassword.jsx
│       │   ├── InfoResetPassword.jsx
│       │   ├── Dashboard.jsx
│       │   ├── AccountSettings.jsx # API-driven subscription management
│       │   ├── AdminDashboard.jsx  # Reads from auth_users
│       │   └── PhasePredictor.jsx
│       └── utils/
│           └── localStorageManager.js
```

## Subscription Tiers
- **Monthly Training Camp:** $3/mo (purple highlight)
- **Quarter by Quarter:** $8/3 months (cyan, Free 14-Day Trial badge)
- **Full Season Strategy:** $30/year (green, Best Value badge)

## Database Collections
- **`auth_users`:** Primary user store — email, password_hash, subscription_status, subscription_tier, stripe_subscription_id
- **`user_sessions`:** Session tokens for authentication
- **`password_resets`:** Password reset tokens (1hr expiry)
- **`admin_sessions`:** Admin authentication tokens
- **`license_keys`:** DEPRECATED — no longer created or read from. Kept for historical data only.

## Key API Endpoints
- `POST /api/auth/register` — Create account + send welcome email
- `POST /api/auth/login` — Login (returns subscription status)
- `POST /api/auth/logout` — Logout
- `GET /api/auth/check` — Check auth + subscription (includes stripe_subscription_id, cancels_at)
- `POST /api/auth/forgot-password` — Request password reset
- `POST /api/auth/reset-password` — Reset password with token
- `GET /api/account/subscription` — Get subscription details
- `POST /api/account/cancel-subscription` — Cancel subscription (session-based)
- `POST /api/webhook/stripe` — Handle Stripe events (ONLY updates existing auth_users, no ghost records)
- `GET /api/admin/users` — List users from auth_users
- `GET /api/admin/stats` — User stats from auth_users

## Routing Rules
| User State | Visits / | Visits /app | Visits /pricing |
|---|---|---|---|
| Not logged in | Home page | → /login | Pricing page |
| Logged in, no subscription | Home page | → /pricing | Pricing page |
| Logged in, active subscription | → /app | Dashboard | → /app |

## Account-First Purchase Flow
1. User visits /pricing and clicks "Get Started" on a plan
2. If NOT logged in: `pending_plan` saved to localStorage → redirect to /signup
3. User creates account on /signup (sees pending plan banner)
4. After registration: redirect to Stripe Payment Link with prefilled_email
5. User completes payment on Stripe
6. Stripe webhook fires → updates auth_users subscription_status
7. User returns to site → polling detects subscription → redirect to /app

---

## Implementation History

### Feb 27, 2026 — Account-First Flow + License Key Abandonment
- **Account-First Purchase Flow:** Unauthenticated users clicking "Get Started" are redirected to /signup with pending plan context
- **Ghost User Prevention:** Stripe webhook no longer creates license_keys records; only updates existing auth_users
- **Welcome Email:** Sent via Resend after successful registration
- **Purchase Confirmation Email:** Sent via Resend after Stripe checkout completes
- **Admin Dashboard Migrated:** Reads from auth_users instead of license_keys
- **InfoNav Updated:** Shows contextual nav (Log In/Sign Up vs Choose a Plan/Log Out)
- **Subscription Polling:** App.js polls auth/check every 3s when user is logged in but has no subscription
- **Testing:** 19/19 backend tests passed, all frontend tests passed (100%)

### Feb 27, 2026 (earlier) — Auth System Finalized & Database Sync
- Stripe webhook sync to auth_users (from license_keys only)
- AccountSettings reads from API instead of localStorage
- Fixed send_subscription_email tier config bug
- About page center-aligned

### Previous Sessions
- Full email/password auth system (register, login, forgot-password, reset-password)
- Informational website (Home, About, Pricing, Contact)
- Stripe Payment Links integration ($3/$8/$30)
- AI Wingman, Phase Predictor, Push Notifications
- Admin dashboard with backend auth

---

## Backlog

### P1 — High Priority
- [ ] Refactor `backend/server.py` into modular router files (auth.py, stripe.py, admin.py)
- [ ] Fix Contact Form (Resend domain verification needed by user)

### P2 — Medium Priority
- [ ] Refactor `Dashboard.jsx` into smaller components
- [ ] Refactor `App.js` routing with ProtectedRoute/PublicRoute wrappers
- [ ] Complete App Store deployment with Capacitor

### P3 — Future
- [ ] Additional notification triggers
- [ ] Analytics dashboard improvements
- [ ] Multi-partner support

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
│   ├── server.py            # Main app + remaining routes
│   ├── database.py          # Shared MongoDB connection
│   ├── dependencies.py      # Shared auth helpers
│   ├── middleware/
│   │   └── cors.py          # StrictCORSMiddleware (echoes exact origin)
│   └── routes/
│       ├── auth.py           # /api/auth/*, /api/account/*
│       ├── stripe.py         # /api/webhook/stripe
│       └── health.py         # /api/health
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

### Mar 2, 2026 — Subscription Entitlement Fix (P0)
- **Root cause:** Stripe API key overridden by system env `sk_test_emergent` → webhooks and API calls silently failing
- **Fix 1:** `load_dotenv(override=True)` ensures real Stripe key from `.env` takes precedence
- **Fix 2:** New `/api/subscription/sync` endpoint queries Stripe directly by email (bypasses webhook dependency)
- **Fix 3:** Webhook handler now matches users by `client_reference_id`, email, AND `stripe_customer_id` (prevents email mismatch)
- **Fix 4:** Frontend Payment Links now include `client_reference_id` (user's app ID) for reliable matching
- **Fix 5:** Frontend polls sync endpoint after login to detect subscriptions
- **Manual fix:** Activated `ts_peterson@yahoo.com` by linking to existing Stripe subscription
- **Testing:** 8/8 backend + all frontend tests passed (100%)

### Feb 28, 2026 — Same-Origin API Fix (Root Cause Resolution)
- **Root cause identified:** Production frontend (cyclecoach.net) was calling external preview backend hosts (partner-sync-6.emergent.host), causing cross-origin CORS/cookie failures
- **Fix:** Set `REACT_APP_BACKEND_URL=""` so ALL API calls use relative paths (`/api/auth/login` instead of `https://external-host/api/auth/login`)
- **All 14 frontend files updated** with `|| ""` fallback for safety
- **Result:** All requests are now same-origin — eliminates CORS and cookie issues entirely
- **Testing:** 16/16 backend + all frontend tests passed (100%), no external host requests detected

### Feb 28, 2026 — P0 CORS + Cookie Fix for Production Auth
- **Cookie SameSite:** Changed from `lax` to `none` + `Secure` on register, login, and logout endpoints
- **CORS Middleware:** Hardened `StrictCORSMiddleware` — echoes exact origin, returns `Access-Control-Allow-Credentials: true` for allowed origins (cyclecoach.net, www.cyclecoach.net, preview URL, localhost)
- **Frontend credentials:** Added `credentials: 'include'` to all fetch calls (App.js, InfoLogin, InfoSignUp, InfoNav, AccountSettings, FeedbackModal)
- **Logout cookie fix:** `delete_cookie` now includes `samesite="none"` and `secure=True`
- **Testing:** 16/16 backend tests + all frontend tests passed (100%)
- **Note:** Emergent preview ingress overrides CORS headers with `*`; middleware verified on localhost:8001. Production Vercel deployment will use middleware's headers correctly.

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

### Apr 20, 2026 — Android Build Fix + Mobile UI Fixes
- **Android Capacitor build**: Updated `android/.gitignore` to un-ignore `capacitor-cordova-android-plugins/`, `app/src/main/assets/public/`, and generated config files. Ran `npx cap sync android` and `yarn build` to regenerate all files. All 16 critical Android Studio files are now tracked in git.
- **Mobile UI overflow fix**: Added `flex-wrap`, responsive text sizes (`text-xs sm:text-sm`), `min-w-0`, and `size="sm"` to Dashboard and AccountSettings headers. Shortened "Privacy & Data" to "Privacy" for mobile. Added responsive padding (`p-4 sm:p-6`, `px-4 sm:px-6`). Made subscription status grid stack on mobile (`grid-cols-1 sm:grid-cols-2`).
- **Testing**: Visual verification via mobile viewport screenshots — headers, buttons, and cards render cleanly at 390px width.

---

## Backlog

### P1 — High Priority
- [x] Fix CORS + cookie configuration for production auth (DONE Feb 28)
- [x] Switch to same-origin relative API paths (DONE Feb 28) — root cause fix
- [x] Fix Android Capacitor build files (DONE Apr 20) — `.gitignore` updated to include generated files
- [x] Fix Mobile UI text wrapping/overflow (DONE Apr 20) — Dashboard & AccountSettings headers
- [ ] Refactor `backend/server.py` remaining routes into modular router files
- [ ] Fix Contact Form (Resend domain verification needed by user)

### P2 — Medium Priority
- [ ] Refactor `Dashboard.jsx` into smaller components
- [ ] Refactor `App.js` routing with ProtectedRoute/PublicRoute wrappers
- [ ] iOS App Store deployment (user needs Mac or CI/CD pipeline)

### P3 — Future
- [ ] Additional notification triggers
- [ ] Analytics dashboard improvements
- [ ] Multi-partner support

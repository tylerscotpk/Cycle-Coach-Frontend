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

### Jun 30, 2026 — Subscription Overhaul: Trial + Basic/Advanced
- **7-day free trial**: Auto-activates on signup, no payment required. Full access to all features including AI Wingman. `plan_type: "trial"`, `trial_ends_at` tracked in DB.
- **New pricing tiers**: Basic ($9/mo) — core features, no AI Wingman. Advanced ($19/mo) — everything + AI Wingman.
- **Removed legacy plans**: Monthly ($3), Quarterly ($8), Annual ($30) pricing removed from frontend. Old Stripe Payment Links replaced with placeholders.
- **Feature gating**: AI Wingman locked behind Advanced plan. Trial users get full access. Basic users see upgrade prompt.
- **Trial banner**: Dashboard shows "Free Trial — X days left" with "View Plans" button.
- **Trial expiration**: When trial expires, `hasSubscription` returns false, user redirected to pricing page.

### Jun 14, 2026 — EWMA Dynamic Cycle Tracking & Extension Flow
- **EWMA Average**: Replaced simple average with Exponential Weighted Moving Average (`0.3 * latest + 0.7 * previous`). Recent cycles weigh more heavily; outlier detection activates after 6+ cycles.
- **Dynamic Cycle Day**: Continuous counting past average — no more wrapping at cycle length. Day counter keeps going (Day 29, 30, 31...).
- **Extension Banner (avg+2)**: In-app banner + push notification when cycle exceeds average by 2 days. User must confirm ("yes, hasn't started") or deny ("enter actual Day 1 date").
- **Capped UI (avg+7)**: Day display caps at "Day 35+" (if avg=28). Playful, non-medical messages displayed. Internal count continues for data accuracy.
- **Confirm/Deny Flow**: Confirming marks cycle as extended (EWMA updates when Day 1 logged). Denying prompts for actual start date and resets cycle.
- **Testing**: 6/6 frontend scenarios passed (normal day, extended banner, capped UI, confirm flow, deny flow, EWMA calculation in history dialog).

### Jul 4, 2026 — Bug Fix + Admin Dashboard Overhaul + PWA Icons
- **Cancel Subscription Bug Fix**: Replaced `AlertDialogAction` with regular `Button` in cancel/downgrade modals to prevent Radix auto-close from aborting async fetch. Added safe `try/catch` around `response.json()` parsing. This was the 3rd occurrence of the recurring response-body double-read pattern.
- **Admin Dashboard Overhaul**: Removed legacy "Trial Requests" tab. Updated filter buttons to: All Users | Free Trial | Basic | Advanced | Cancelled | No Plan. Stats cards show Free Trial, Basic, Advanced, Cancelled counts. User rows display tier badge + status badge. Added "Grant Lifetime Access" button with confirmation modal — sets user to `grandfathered` tier and cancels any active Stripe subscription.
- **Backend Admin Endpoints**: Updated `/api/admin/stats` to return new tier counts. Added `plan_type` and `no_plan` query params to `/api/admin/users`. Added `POST /api/admin/grant-lifetime/{email}` endpoint.
- **PWA Icons**: Generated and added `icon-192.png` (192x192) and `icon-512.png` (512x512) to resolve manifest console error.
- **Downgrade Flow**: Already existed (Advanced → Basic); added safe JSON parsing to the handler.
- **Testing**: 11/11 backend tests passed, frontend UI verified. All changes confirmed working.

### Jul 4, 2026 (update 2) — Onboarding Re-prompt Bug Fix
- **Root Cause**: Two issues: (1) `clearAllData()` in `clearOnLogout` explicitly deleted `cyclecoach_state_waiver_complete_${uid}` and `cyclecoach_consent_granted_${uid}`, so onboarding flags were wiped on every logout. (2) In `AppContent`, onboarding flags were read in a `useEffect` (runs AFTER render), so the first render always showed the waiver screen before the effect could correct the state.
- **Fix**: (1) Removed onboarding flag deletion from `clearAllData` — these are compliance acknowledgments that persist across sessions. (2) Replaced async `useEffect` flag reading with synchronous `localStorage.getItem()` during render — flags are now read before any routing decision is made.
- **Files changed**: `localStorageManager.js` (clearAllData), `App.js` (AppContent onboarding logic)
- **Testing**: Verified full cycle — complete onboarding → logout → re-login → dashboard loads directly (no waiver/consent re-prompt).
- **Backend Auth Guards**: Added `require_admin` dependency (validates admin session token from `admin_sessions` collection with expiry check). Applied to all 11 protected admin endpoints: `/admin/stats`, `/admin/users`, `/admin/feedback`, `/admin/grant-key`, `/admin/grant-lifetime`, `/admin/archive-user`, `/admin/unarchive-user`, `/admin/cancel-user`, `/admin/restore-user`, `/trial/requests`, `/trial/approve`, `/trial/reject`. Login/verify/logout remain public.
- **Frontend Auth Headers**: All admin dashboard fetch calls now include `Authorization: Bearer <token>` header. Auto-logout on 401 response.
- **Lifetime Stat Card**: Added "Lifetime" count to `/api/admin/stats` (queries `subscription_tier: "grandfathered"`). Frontend shows 5 stat cards: Free Trial, Basic, Advanced, Lifetime, Cancelled — totals now reconcile.

### Jul 4, 2026 (update 3) — 7 Subscription Flow Bug Fixes
- **Grandfathered tier recognition**: Auth check now evaluates `subscription_tier == "grandfathered"` FIRST, bypassing subscription_status. Webhook handlers skip grandfathered users to prevent status regression.
- **Upgrade prompts hidden**: `hasAIAccess` includes `grandfathered`. No upgrade prompts for advanced/grandfathered.
- **Features list tier-aware**: AI Wingman shows checkmark for advanced/grandfathered/trial, X mark for basic.
- **Double charging fixed**: Dashboard upgrade uses `/subscription/upgrade` (in-place swap) when user has existing Stripe subscription, avoids creating duplicate.
- **Duplicate Stripe customers fixed**: Checkout reuses existing `stripe_customer_id` or searches by email before creating new customer.
- **Testing**: 9/9 backend + full frontend E2E verified.

### Jul 6, 2026 — Deactivate/Restore Flow Overhaul
- **Deactivated users blocked from re-registering**: Returns "This account has been deactivated. Please contact support." (403) instead of "Account already exists".
- **Deactivated users blocked from login**: Same message on login attempt.
- **Admin Deactivate saves state**: Saves `pre_deactivation_status`, `pre_deactivation_tier`, `pre_deactivation_plan` before setting `is_active: false`. Sends deactivation notification email via Resend.
- **Admin Restore fully restores**: Sets `is_active: true` and restores previous subscription tier/status/plan from saved state. Immediate login works.
- **Admin Dashboard**: Added "Deactivated" filter tab with count. Deactivated users show "deactivated" status badge and "Reactivate" button. Active users show full action set (Grant Lifetime, Restore, Cancel, Deactivate).
- **DB Fix**: ts_peterson@yahoo.com set to `is_active: true`, `subscription_status: active`, `subscription_tier: advanced`.
- **Testing**: Full flow verified — deactivate → block registration → block login → restore → login works with restored tier.

### Jul 6, 2026 (update) — 6 Subscription Flow Bug Fixes
- **Upgrade fallback to checkout**: Upgrade endpoint now returns `{use_checkout: true}` for ghost subscriptions (incomplete_expired, canceled, incomplete). Dashboard and Account Settings both fall back to Stripe Checkout when in-place upgrade isn't possible.
- **Cancel modal always closes**: `setShowCancelModal(false)` called in all paths — success, error response, and catch block.
- **incomplete_expired handling**: Cancel endpoint detects ghost subscriptions, cleans up `stripe_subscription_id` in DB, and returns success with cleanup message.
- **Account page Basic tier display**: Tier badge uses `(subscription_tier || plan_type)` fallback. Billing amount correctly shows $5/mo for Basic.
- **Upgrade button for Basic users**: Account Settings now shows "Upgrade to Advanced — $8/mo" button for active Basic subscribers.
- **Grandfathered display name**: Added 'Lifetime' mapping to `getTierDisplayName` and purple badge color.

### Aug 8, 2026 — Coaching Manual + Phase Modal Restructure
- **Coaching Manual**: New tab alongside AI Wingman and Partner Profile. 17 terms across 3 categories (Hormones, Cycle Phases, General Terms). Single-open accordion with smooth CSS animation and auto-scroll.
- **Phase Modal Restructure**: Replaced old "Game Plan" tips with structured layout: Punch-line, Play-by-Play, What She Feels (Physical + Mental/Emotional), Prep (collapsible), Action (collapsible). All 5 phases updated with detailed content. Prep/Action expand independently.
- **Testing**: 100% frontend pass on both features.
- **Testing**: 7/7 backend passed, frontend code-reviewed and verified.

---

## Backlog

### P1 — High Priority
- [x] Fix CORS + cookie configuration for production auth (DONE Feb 28)
- [x] Switch to same-origin relative API paths (DONE Feb 28)
- [x] Fix Android Capacitor build files (DONE Apr 20)
- [x] Fix Mobile UI text wrapping/overflow (DONE Apr 20)
- [x] EWMA dynamic cycle tracking with extension alerts (DONE Jun 14)
- [x] Subscription overhaul: 7-day trial + Basic/Advanced (DONE Jun 30)
- [x] Cancel subscription bug fix (DONE Jul 4)
- [x] Admin dashboard overhaul for new tier structure (DONE Jul 4)
- [x] PWA icon fix (DONE Jul 4)
- [x] Admin API auth guards (DONE Jul 4)
- [x] Lifetime stat card in admin dashboard (DONE Jul 4)
- [x] Onboarding re-prompt bug fix (DONE Jul 4)
- [x] 7 subscription flow bug fixes — grandfathered recognition, double charging, duplicate customers, feature gating (DONE Jul 4)
- [ ] Connect real Stripe Payment Links for Basic ($5/mo) and Advanced ($8/mo)
- [ ] Refactor `backend/server.py` remaining routes into modular router files

### P2 — Medium Priority
- [ ] Refactor `Dashboard.jsx` into smaller components
- [ ] Refactor `App.js` routing with ProtectedRoute/PublicRoute wrappers
- [ ] iOS App Store deployment (user needs Mac or CI/CD pipeline)

### P3 — Future
- [ ] Additional notification triggers
- [ ] Analytics dashboard improvements
- [ ] Multi-partner support

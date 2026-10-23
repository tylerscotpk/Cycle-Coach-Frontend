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
- **Native Notifications:** Capacitor Local Notifications for phase-change reminders and partner nudges on iOS/Android; browser Notification API fallback on web

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI, Capacitor (native builds)
- **Backend:** FastAPI, MongoDB
- **Data Storage:** Browser `localStorage` for cycle data, MongoDB `auth_users` for users/subscriptions
- **Integrations:** Stripe (payments), Resend (emails), OpenAI GPT (AI Wingman), @capacitor/local-notifications (native notifications)

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
│   ├── capacitor.config.json # Capacitor config with LocalNotifications plugin
│   ├── android/              # Capacitor Android source
│   ├── ios/                  # Capacitor iOS source
│   └── src/
│       ├── App.js              # Routing + AuthContext + subscription polling
│       ├── components/
│       │   ├── CoachingManual.jsx
│       │   ├── MoodMap.jsx
│       │   ├── NotificationSettings.jsx  # Phase Reminders + Partner Nudges toggles
│       │   ├── PhaseDetailModal.jsx
│       │   └── ui/             # Shadcn UI components
│       ├── pages/
│       │   ├── Dashboard.jsx   # Main app + rescheduleNotifications hooks
│       │   ├── AdminDashboard.jsx
│       │   ├── PhasePredictor.jsx
│       │   └── VerifyEmail.jsx
│       └── utils/
│           ├── cycleCalculations.js   # Dynamic clinical cycle math
│           ├── localStorageManager.js # Namespaced storage (includes partnerNudges setting)
│           ├── phaseContent.js        # Single source of truth for phase text
│           └── notificationService.js # Native + web notification logic
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

## Notification System
- **Phase Reminders:** Scheduled 1 day before each phase transition at 9 AM local time. Copy pulled from `phaseContent.js` (`planningTip` for body, display `name` for title).
- **Day 1 Check-in:** Fires on predicted Day 1 of next cycle at 9 AM. Native: Yes/No action buttons — "Yes" logs Day 1 via same path as manual period logging, "No" shows dismissal message on next app open. Web: browser notification prompting user to log in Cycle History. Default ON.
- **Cycle Extension Alert:** Fires once per cycle when cycle exceeds EWMA avg + 2 days. Native + Web.
- **Cold-start disclaimers** (when total_cycles_tracked === 0):
  - Dashboard phase card: "Estimated cycle — accuracy improves with more data."
  - Phase Predictor: "Estimated using a typical cycle — accuracy improves as you log more history."
  - Notification body: appends " (Estimated — no history yet)"
- **Scheduling:** Based on `computePhaseBoundaries()` from cycleCalculations.js
- **Reschedule triggers:** New partner created, period logged, cycle entry deleted, extension denied, Day 1 confirmed via notification
- **Native:** `@capacitor/local-notifications` for iOS/Android with `LocalNotifications.schedule()`
- **Web:** Browser `Notification` API fires on app visit
- **No SCHEDULE_EXACT_ALARM:** Standard scheduling used to avoid Android policy concerns
- **De-duplication:** `logDay1FromNotification` checks if date already exists as most recent cycle entry

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
- [x] Native Capacitor Local Notifications — phase reminders + partner nudges (DONE Aug 27)
- [x] Notification overhaul — phaseContent.js copy, Day 1 check-in, cold-start disclaimers, extension on native (DONE Aug 30)
- [x] Dynamic day ranges in Phase Detail Modal (DONE Aug 30)
- [x] iOS Safari DatePicker-in-Dialog fix (DONE Aug 30)
- [x] Age confirmation + Terms of Service on signup (DONE Sep 27)
- [x] Dashboard.jsx split into sub-components (1862→1341 lines) (DONE Sep 27)
- [x] Server.py modularization — admin, AI, contact routes extracted (2394→1694 lines) (DONE Sep 27)
- [ ] Connect real Stripe Payment Links for Basic ($5/mo) and Advanced ($8/mo)
- [x] Downgrade retains Advanced until period end (DONE Sep 27)
- [x] Price IDs moved to environment variables (DONE Sep 27)
- [x] Legacy cancel endpoint removed (DONE Sep 27)
- [x] Webhook signature verification enforced (DONE Sep 27)

### P2 — Medium Priority
- [x] Unify static vs dynamic day ranges in PhaseDetailModal/PhasePredictor/MoodMap (DONE Aug 30)
- [ ] Remove `verification_token` from admin users API response
- [ ] Remove `verification_token` from admin users API response
- [x] Refactor `Dashboard.jsx` into smaller components (DONE Sep 27)
- [ ] Refactor `App.js` routing with ProtectedRoute/PublicRoute wrappers
- [ ] iOS App Store deployment (user needs Mac or CI/CD pipeline)

### P3 — Future
- [x] Replace native date inputs with Shadcn Calendar component (DONE Aug 30)
- [ ] Multi-partner support
- [ ] Analytics dashboard improvements

## 2026-10-23 — Apple rejection fixes (Build 9 prep) — NOT DEPLOYED (awaiting approval)
- iOS external checkout sheet (utils/checkout.js, components/ExternalCheckoutDialog.jsx): iOS-native only; tap opens Stripe in Safari; "I've completed payment" + auto re-check on app foreground. Web/Android unchanged redirect.
- Fixed stuck "Loading..." plan buttons after Safari handoff; stale email_verified re-checked before blocking checkout; Pricing "Upgrade" now upgrades in place (no duplicate sub).
- /api/subscription/sync now sets plan_type/tier from Stripe price (activation fix when webhook missed).
- /api/account/delete (password + "DELETE"; refunds unused paid days, cancels Stripe subs, purges server records, keeps anonymized account_deletions audit; billing failure → 409, account kept; idempotent refund keys) + local data wipe + /account-deleted page.
- /api/account/undo-cancellation (verifies with Stripe before success) + UI section.
- /account reachable for logged-in users without a plan; nav "Account" link.
- Startup: inline HTML spinner, 12s auth-check timeout with Retry screen; VerifyEmail "I've Verified — Continue" + iPadOS detection.
- Tests: backend/tests/test_account_lifecycle.py (Stripe mocked, 11 pass); iteration_31 frontend 100%.

## 2026-10-23 — Deletion refund hardening (approved; NOT deployed)
- New backend/routes/deletion_refunds.py: line-by-line unused-paid calculation across all paid invoices in period (upgrades, discounts, multiple payments), capped by remaining refundable, dedup via existing account_deletion refunds + per-invoice idempotency key.
- Order: plan recorded (deletion_refunds, no email) → subscription cancelled → refunds attempted. Refund/calculation failure never blocks deletion: status needs_attention, admin email alert, reference shown to user on /account-deleted.
- Cancellation failure still returns 409 (temporary; account kept); retry resumes the planned refund without duplicating.
- Admin: GET /api/admin/deletion-refunds, POST .../{ref}/retry (recomputes as of deletion time), POST .../{ref}/mark-resolved; panel in AdminDashboard.
- Tests: backend/tests/test_account_lifecycle.py 17/17 (Stripe fully mocked; real Stripe calls raise).

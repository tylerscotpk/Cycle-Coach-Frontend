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
- [ ] Connect real Stripe Payment Links for Basic ($5/mo) and Advanced ($8/mo)
- [ ] Refactor `backend/server.py` remaining routes into modular router files

### P2 — Medium Priority
- [x] Unify static vs dynamic day ranges in PhaseDetailModal/PhasePredictor/MoodMap (DONE Aug 30)
- [ ] Remove `verification_token` from admin users API response
- [ ] Remove `verification_token` from admin users API response
- [ ] Refactor `Dashboard.jsx` into smaller components
- [ ] Refactor `App.js` routing with ProtectedRoute/PublicRoute wrappers
- [ ] iOS App Store deployment (user needs Mac or CI/CD pipeline)

### P3 — Future
- [ ] Replace native date inputs with Shadcn Calendar component
- [ ] Multi-partner support
- [ ] Analytics dashboard improvements

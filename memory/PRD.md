# Cycle Coach - Product Requirements Document

## Original Problem Statement
Create a mobile-friendly web app called "Cycle Coach" to help men understand their partners' menstrual cycles. The app should track cycles, provide phase-based tips, and feature an "AI Wingman" for personalized advice. Key UI elements include a MoodMap visualizer, partner profile, and dynamic resources section.

**Critical Privacy Requirement:** All personal cycle data remains on the user's device (localStorage). The backend only stores anonymized subscription/license data.

## User Personas
- **Primary:** Men in relationships who want to better understand their partner's menstrual cycle
- **Use Case:** Track partner's cycle (with consent), get phase-based tips, access AI coaching

## Subscription Tiers (Game Plans)

| Tier | Name | Price | Trial | Features |
|------|------|-------|-------|----------|
| **free_training** | Free Training | $0 | 30 days | Cycle tracking, tips, research insights, resources |
| **winning** | Winning Game Plan | $1.99/mo | - | Same as trial (ongoing access) |
| **elite** | Elite Game Plan | $2.99/mo | - | All features + Partner Profile + AI Wingman |
| **grandfathered** | Elite (Lifetime) | Free | - | All features (existing lifetime/yearly users) |

### Trial Flow (Payment Required)
1. User enters email and clicks "Start Free Training"
2. Redirects to Stripe Checkout to enter payment info
3. 30-day free trial begins (card not charged)
4. After 30 days, auto-converts to Winning Game Plan ($1.99/mo)
5. User can cancel anytime during or after trial

### Feature Gating
- **Free Training / Winning:** Cycle tracking, tips, research insights, resources
- **Elite / Grandfathered:** All features + Partner Profile + AI Wingman
- Non-elite users see upgrade prompts and locked feature indicators

### Feedback System
Feedback prompts (rating 1-5 stars + text) appear:
- **Day 7** of trial
- **On cancellation**
- **On conversion** to paid plan

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI, Capacitor
- **Backend:** FastAPI (AI proxy + subscription management)
- **Data Storage:** Browser localStorage (user data), MongoDB (subscription data)
- **AI:** OpenAI GPT-5 via Emergent LLM Key
- **Payments:** Stripe (subscriptions with trial periods)
- **Email:** Resend (license key delivery)

## Key Files
- `/app/frontend/src/components/Paywall.jsx` - Tiered pricing UI
- `/app/frontend/src/components/FeedbackModal.jsx` - Feedback collection
- `/app/frontend/src/pages/Dashboard.jsx` - Main app with feature gating
- `/app/frontend/src/pages/AdminDashboard.jsx` - Admin management
- `/app/frontend/src/utils/localStorageManager.js` - Data persistence
- `/app/backend/server.py` - API server

## API Endpoints

### Subscription
- `GET /api/subscription/tiers` - Get tier info and pricing
- `POST /api/trial/request` - Create Stripe checkout for Free Training
- `POST /api/subscription/create-checkout` - Create checkout for paid plans
- `POST /api/subscription/upgrade` - Upgrade to Elite
- `POST /api/license/validate` - Validate key, returns tier info
- `POST /api/license/resend` - Resend license key
- `POST /api/webhook/stripe` - Handle Stripe events

### Feedback
- `POST /api/feedback/submit` - Submit rating + text feedback
- `GET /api/feedback/check/{email}` - Check if user should see feedback prompt
- `GET /api/admin/feedback` - Get all feedback (admin)

### Admin
- `GET /api/admin/users` - List all users/licenses
- `POST /api/admin/grant-key` - Grant manual license key
- `POST /api/admin/archive-user` - Archive user
- `POST /api/admin/cancel-user` - Cancel subscription

## Completed Tasks
- [x] Privacy-first architecture (localStorage for user data)
- [x] Cycle tracking with phase detection
- [x] MoodMap visualizer
- [x] AI Wingman (anonymous proxy)
- [x] Partner Profile tab
- [x] Resources tab (static data)
- [x] Research-backed insights
- [x] Paywall with license key validation
- [x] Stripe webhook integration
- [x] Resend email integration
- [x] Admin Dashboard
- [x] Capacitor setup for app stores
- [x] **Tiered Subscription System (January 2025)**
  - [x] "Choose Game Plan" UI with 3 tiers
  - [x] Free Training → Winning → Elite naming
  - [x] Payment info required for trial (Stripe trial period)
  - [x] Auto-conversion to Winning after 30 days
  - [x] Feature gating (Partner Profile, AI Wingman)
  - [x] Upgrade prompts for non-elite users
  - [x] Grandfathered access for existing users
- [x] **Feedback System (January 2025)**
  - [x] Rating + text feedback modal
  - [x] Day 7 trial prompt
  - [x] Conversion prompt
  - [x] Cancellation prompt
  - [x] Admin feedback view

## Upcoming Tasks

### P0 - High Priority
- [ ] Configure valid Stripe API keys for production
- [ ] Test full trial → conversion flow with real Stripe
- [ ] Create Privacy Policy page

### P1 - Medium Priority
- [ ] App Store submission (iOS/Android)
- [ ] Refactor Dashboard.jsx into smaller components
- [ ] Clean up deprecated code in server.py

### P2 - Low Priority
- [ ] PWA Push Notifications
- [ ] Email templates for subscription reminders

## Admin Access
- **URL:** `/admin`
- **Password:** `cyclecoach2024`

## Legacy Test Keys (Grandfathered)
- CYCLE-COACH-2024-ALPHA
- CYCLE-COACH-2024-BETA
- CC-FOUNDER-SPECIAL

## Environment Variables
- `STRIPE_API_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret
- `RESEND_API_KEY` - Resend email API key
- `MONGO_URL` - MongoDB connection string
- `EMERGENT_MODEL_API_KEY` - For AI Wingman

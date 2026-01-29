# Cycle Coach - Product Requirements Document

## Original Problem Statement
Create a mobile-friendly web app called "Cycle Coach" to help men understand their partners' menstrual cycles. The app should track cycles, provide phase-based tips, and feature an "AI Wingman" for personalized advice. Key UI elements include a MoodMap visualizer, partner profile, and dynamic resources section.

**Critical Privacy Requirement:** All personal cycle data remains on the user's device (localStorage). The backend only stores anonymized subscription/license data.

## User Personas
- **Primary:** Men in relationships who want to better understand their partner's menstrual cycle
- **Use Case:** Track partner's cycle (with consent), get phase-based tips, access AI coaching

## Subscription Tiers (Current Model)

| Tier | Name | Price | Features |
|------|------|-------|----------|
| **monthly** | Monthly Training Plan | $3.99/mo (7-day trial) | All features |
| **quarterly** | Quarter by Quarter | $10.49/3 months | All features |
| **annual** | Full Season Strategy | $35.91/year | All features |
| **grandfathered** | Elite (Lifetime) | Free | All features (existing users) |

**Note:** All subscription plans grant full access to all features (no feature gating).

### Payment Flow
1. User selects a subscription plan on the Paywall
2. Redirected to Stripe Payment Link
3. Upon successful payment, Stripe webhook generates license key
4. License key emailed via Resend
5. User enters license key to access the app

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI, Capacitor
- **Backend:** FastAPI (AI proxy + subscription management)
- **Data Storage:** Browser localStorage (user data), MongoDB (subscription data)
- **AI:** OpenAI GPT-5 via Emergent LLM Key
- **Payments:** Stripe (Payment Links + Webhooks)
- **Email:** Resend (license key delivery)

## Key Files
- `/app/frontend/src/components/Paywall.jsx` - Subscription plans UI
- `/app/frontend/src/components/StatePrivacyWaiver.jsx` - US state privacy flow
- `/app/frontend/src/components/NotificationSettings.jsx` - Notification preferences
- `/app/frontend/src/pages/Dashboard.jsx` - Main app dashboard
- `/app/frontend/src/pages/PrivacySettings.jsx` - Privacy & data management
- `/app/frontend/src/pages/AdminDashboard.jsx` - Admin management
- `/app/frontend/src/utils/localStorageManager.js` - Data persistence
- `/app/frontend/src/utils/notificationService.js` - Push notification logic
- `/app/backend/server.py` - API server

## API Endpoints

### License & Subscription
- `POST /api/license/validate` - Validate license key, returns tier info
- `POST /api/webhook/stripe` - Handle Stripe payment events

### AI Wingman
- `POST /api/chat/anonymous` - Anonymous AI chat with partner profile context
  - Accepts: `message`, `cycle_day`, `phase`, `partner_profile` (with name, preferences, cycle_length)
  - AI uses partner profile for personalized responses

### Feedback
- `POST /api/feedback` - Submit user feedback

### Admin
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/users` - List all users/licenses
- `GET /api/admin/requests` - Trial request history

## Completed Tasks

### Core Features
- [x] Privacy-first architecture (localStorage for user data)
- [x] Cycle tracking with phase detection (5 phases)
- [x] MoodMap visualizer (interactive wheel)
- [x] Partner Profile tab with preferences storage
- [x] Resources tab with external links disclaimer
- [x] Research-backed insights with source citations
- [x] Paywall with license key validation
- [x] Stripe webhook integration
- [x] Resend email integration
- [x] Admin Dashboard
- [x] Capacitor setup for app stores

### January 2025 Updates
- [x] Subscription model overhaul (3 plans via Payment Links)
- [x] Feedback system with rating + text collection
- [x] State Privacy Waiver flow for US users
- [x] Partner consent acknowledgment flow

### January 29, 2025 Updates
- [x] **AI Wingman Personalization Enhancement**
  - Enhanced partner profile context (all preferences now sent to AI)
  - Improved AI system prompt for better personalization
  - AI now references partner name, preferences, entertainment choices
- [x] **Push Notification System**
  - Full notification service (`notificationService.js`)
  - Phase transition reminders (1 day before phase change)
  - Reflection prompts (periodic check-ins)
  - Permission handling with enable/test buttons
- [x] **Notification Settings UI**
  - Permission status display
  - Toggle controls for each notification type
  - Test notification button
  - Privacy-focused messaging
- [x] **Resources Tab Cleanup**
  - External links disclaimer at top
  - Verified resource links

## Upcoming Tasks

### P1 - High Priority
- [ ] App Store submission (iOS/Android) using Capacitor
- [ ] Test push notifications on mobile devices (Capacitor)

### P2 - Medium Priority
- [ ] Refactor Dashboard.jsx into smaller components
- [ ] Clean up deprecated code in server.py
- [ ] Service worker for background notification scheduling

### P3 - Low Priority
- [ ] Email templates for subscription reminders
- [ ] A/B testing for paywall copy

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

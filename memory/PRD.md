# Cycle Coach - Product Requirements Document

## Original Problem Statement
Create a mobile-friendly web app called "Cycle Coach" (originally "Do Her Better") to help men understand their partners' menstrual cycles. The app should track cycles, provide humorous, phase-based tips, and feature an "AI Wingman" for personalized advice. Key UI elements include a MoodMap visualizer, partner profile, and dynamic resources section.

**Critical Privacy Requirement:** The app must operate with complete user anonymity. No server-side data storage, no personally identifiable information linked to cycle data. All data must remain on the user's device.

## User Personas
- **Primary:** Men in relationships who want to better understand their partner's menstrual cycle
- **Use Case:** Track partner's cycle (with consent), get phase-based tips, access AI coaching

## Core Features

### Completed Features ✅
1. **Privacy-First Architecture**
   - All data stored in browser localStorage (no server accounts)
   - Mandatory Partner Consent screen
   - Privacy Settings page (export/import/delete data)
   - Anonymous AI chat proxy

2. **Cycle Tracking**
   - Partner profile creation with cycle start date
   - Automatic phase detection (Menstrual, Follicular, Ovulation, Early Luteal, Late Luteal/PMS)
   - Cycle day calculation with phase-specific tips
   - Cycle History with statistics and predictions

3. **MoodMap Visualizer**
   - Visual donut chart showing all cycle phases
   - Phase icons and legend highlighting
   - Interactive phase details

4. **AI Wingman** (Premium Feature)
   - Anonymous chat via backend proxy
   - Phase-aware responses
   - No chat history stored (ephemeral)

5. **Partner Profile Tab** (Premium Feature)
   - Store preferences (coffee order, comfort food, love language, etc.)
   - Entertainment preferences (movies, music, podcasts)
   - All data saved to localStorage

6. **Resources Tab** (All Plans)
   - Static phase-matched resources
   - Bookmark and archive functionality
   - "For Today" badges for current phase resources
   - External links to articles and guides

7. **PWA Configuration**
   - Installable on devices
   - Offline-capable manifest

8. **Tiered Subscription System** (January 2025) ✅
   - **Free Trial:** $0 for 30 days (auto-approved)
   - **Basic:** $1.99/month
   - **Premium:** $2.99/month
   - Feature gating for Partner Profile and AI Wingman
   - Upgrade prompts for non-premium users
   - Grandfathered access for existing lifetime/yearly users

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI, Capacitor (for app stores)
- **Backend:** FastAPI (AI proxy + subscription management)
- **Data Storage:** Browser localStorage (user data), MongoDB (license/subscription data)
- **AI:** OpenAI GPT-5 via Emergent LLM Key (anonymous proxy)
- **Payments:** Stripe (recurring subscriptions)
- **Email:** Resend (license key delivery)

## Key Files
- `/app/frontend/src/pages/Dashboard.jsx` - Main app component
- `/app/frontend/src/pages/AdminDashboard.jsx` - Admin management UI
- `/app/frontend/src/components/Paywall.jsx` - Tiered pricing/subscription UI
- `/app/frontend/src/utils/localStorageManager.js` - Data persistence + tier info
- `/app/frontend/src/utils/cycleCalculations.js` - Cycle logic
- `/app/frontend/src/utils/resourcesData.js` - Static resources
- `/app/frontend/src/utils/cycleFacts.js` - Research-backed insights
- `/app/backend/server.py` - API server (AI proxy, subscriptions, webhooks)

## Subscription Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free Trial** | $0 (30 days) | Cycle tracking, tips, research insights, resources |
| **Basic** | $1.99/month | Same as trial + ongoing access |
| **Premium** | $2.99/month | All features + Partner Profile + AI Wingman |
| **Grandfathered** | Free (lifetime) | All features (existing lifetime/yearly users) |

## API Endpoints

### Subscription & License
- `POST /api/trial/request` - Auto-approve free trial, returns license key
- `POST /api/license/validate` - Validate key, returns tier info
- `POST /api/license/resend` - Resend license key to email
- `GET /api/subscription/tiers` - Get available tiers and pricing
- `POST /api/subscription/create-checkout` - Create Stripe checkout session
- `POST /api/subscription/upgrade` - Create upgrade checkout session
- `POST /api/webhook/stripe` - Handle Stripe subscription events

### Admin
- `GET /api/admin/users` - List all users/licenses
- `POST /api/admin/grant-key` - Grant manual license key
- `POST /api/admin/archive-user` - Archive user
- `POST /api/admin/cancel-user` - Cancel subscription

## Completed Tasks
- [x] Privacy-first architecture overhaul
- [x] Remove Google OAuth and server-side accounts
- [x] Implement mandatory consent flow
- [x] Create Privacy Settings page
- [x] Re-enable AI Wingman via anonymous proxy
- [x] Fix cycle history bugs (deletion, status logic, date parsing)
- [x] Rename app from "Do Her Better" to "Cycle Coach" (December 2025)
- [x] Re-enable Resources Tab with static data (December 2025)
- [x] Implement Minimum Viable Monetization - Paywall + License Key (December 2025)
- [x] Stripe webhook integration for auto license key generation (December 2025)
- [x] Resend email integration for license key delivery (December 2025)
- [x] Server-side license key validation (December 2025)
- [x] Trial request system with admin approval workflow (December 2025)
- [x] Admin Dashboard for managing trial requests (December 2025)
- [x] Capacitor setup for iOS/Android app store deployment (December 2025)
- [x] **Tiered Subscription System** (January 2025)
  - [x] Three tiers: Free Trial, Basic ($1.99), Premium ($2.99)
  - [x] Auto-approve free trials (no admin needed)
  - [x] Feature gating for Partner Profile and AI Wingman
  - [x] Upgrade prompts and banner for non-premium users
  - [x] Grandfathered access for existing lifetime/yearly users
  - [x] Stripe subscription checkout integration

## Upcoming Tasks (Prioritized Backlog)

### P0 - High Priority
- [ ] Configure valid Stripe API keys for production checkout
- [ ] Create Privacy Policy page/URL (required for app stores)
- [ ] Generate app store screenshots
- [ ] Submit to Apple App Store
- [ ] Submit to Google Play Store

### P1 - Medium Priority
- [ ] Add more resources to resourcesData.js
- [ ] Refactor Dashboard.jsx into smaller components
- [ ] Clean up deprecated code in server.py

### P2 - Low Priority
- [ ] PWA Push Notifications for daily tips
- [ ] Email templates for subscription renewal reminders

## Known Limitations
- Resources are static (not dynamically fetched from API)
- No user accounts (by design for privacy)
- AI chat history is ephemeral (not stored)
- Stripe checkout requires valid API key (currently using placeholder)

## Monetization Configuration
- **Stripe Webhook:** `/api/webhook/stripe`
- **Email Service:** Resend (sends from `info@cyclecoach.net`)
- **License Format:** `CC-XXXX-XXXX-XXXX` (auto-generated)
- **Validation:** Server-side via `/api/license/validate`
- **Legacy Test Keys (grandfathered):**
  - CYCLE-COACH-2024-ALPHA
  - CYCLE-COACH-2024-BETA
  - CC-FOUNDER-SPECIAL

## Admin Access
- **URL:** `/admin`
- **Password:** `cyclecoach2024`

## Data Model (localStorage)
```javascript
// Key: cyclecoach_partner_profile
{
  id: string,
  partnerName: string,
  cycleStartDate: string,
  cycleLength: number,
  preferences: object,
  createdAt: string
}

// Key: cyclecoach_cycle_history
[{
  id: string,
  cycle_start_date: string,
  cycle_length: number,
  status: 'current' | 'completed'
}]

// Key: cyclecoach_consent
{
  granted: boolean,
  timestamp: string,
  acknowledgedRisks: boolean
}

// Key: cyclecoach_license
{
  key: string,
  activatedAt: string,
  isValid: boolean
}

// Key: cyclecoach_subscription (NEW)
{
  tier: 'free_trial' | 'basic' | 'premium' | 'grandfathered',
  has_partner_profile: boolean,
  has_ai_wingman: boolean,
  expires_at: string | null,
  email: string,
  savedAt: string
}
```

## Database Schema (MongoDB)

### license_keys collection
```javascript
{
  id: string,
  license_key: string (unique),
  customer_email: string,
  stripe_session_id: string,
  stripe_subscription_id: string | null,
  is_active: boolean,
  is_cancelled: boolean,
  key_type: 'free_trial' | 'basic' | 'premium' | 'lifetime' | 'yearly',
  subscription_tier: 'free_trial' | 'basic' | 'premium' | 'grandfathered',
  expires_at: string | null,
  activation_count: number,
  created_at: string
}
```

### trial_requests collection
```javascript
{
  id: string,
  email: string (unique),
  status: 'pending' | 'approved' | 'rejected',
  license_key: string | null,
  created_at: string,
  approved_at: string | null
}
```

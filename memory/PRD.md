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

4. **AI Wingman**
   - Anonymous chat via backend proxy
   - Phase-aware responses
   - No chat history stored (ephemeral)

5. **Partner Profile Tab**
   - Store preferences (coffee order, comfort food, love language, etc.)
   - Entertainment preferences (movies, music, podcasts)
   - All data saved to localStorage

6. **Resources Tab** (Re-enabled December 2025)
   - Static phase-matched resources
   - Bookmark and archive functionality
   - "For Today" badges for current phase resources
   - External links to articles and guides

7. **PWA Configuration**
   - Installable on devices
   - Offline-capable manifest

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI
- **Backend:** FastAPI (stateless anonymous AI proxy only)
- **Data Storage:** Browser localStorage
- **AI:** OpenAI GPT-5 via Emergent LLM Key (anonymous proxy)

## Key Files
- `/app/frontend/src/pages/Dashboard.jsx` - Main app component
- `/app/frontend/src/utils/localStorageManager.js` - Data persistence
- `/app/frontend/src/utils/cycleCalculations.js` - Cycle logic
- `/app/frontend/src/utils/resourcesData.js` - Static resources
- `/app/backend/server.py` - Anonymous AI proxy

## Completed Tasks
- [x] Privacy-first architecture overhaul
- [x] Remove Google OAuth and server-side accounts
- [x] Implement mandatory consent flow
- [x] Create Privacy Settings page
- [x] Re-enable AI Wingman via anonymous proxy
- [x] Fix cycle history bugs (deletion, status logic, date parsing)
- [x] Fix average cycle length calculation
- [x] Rename app from "Do Her Better" to "Cycle Coach" (December 2025)
- [x] Re-enable Resources Tab with static data (December 2025)
- [x] Implement Minimum Viable Monetization - Paywall + License Key (December 2025)

## Upcoming Tasks (Prioritized Backlog)

### P0 - High Priority
- [ ] Set up Stripe webhook to auto-generate license keys on purchase
- [ ] Create license key delivery system (email on purchase)

### P1 - Medium Priority
- [ ] Automate license key system (Stripe webhooks)
- [ ] Add more resources to resourcesData.js
- [ ] Refactor Dashboard.jsx into smaller components

### P2 - Low Priority
- [ ] PWA Push Notifications for daily tips
- [ ] Clean up deprecated code in server.py

## Known Limitations
- Resources are static (not dynamically fetched from API)
- No user accounts (by design for privacy)
- AI chat history is ephemeral (not stored)

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
```

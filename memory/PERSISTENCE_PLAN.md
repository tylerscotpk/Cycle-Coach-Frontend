# Cycle Coach — Server-Side Data Persistence Plan

## Overview
Currently, all user-specific Cycle Coach data is stored exclusively in browser localStorage. This plan proposes migrating each data type to server-side storage keyed to the authenticated user's account, enabling cross-device access and true persistence.

---

## Data Type Analysis

### 1. Partner Profile
- **Backend endpoint exists?** Yes — `POST/GET /api/partner-profile` in `server.py`
- **Database collection exists?** Yes — `partner_profiles`
- **Should persist server-side?** Yes (core user data)
- **Key:** `user_id` (from `auth_users.id`)
- **Sync strategy:** Write-through — every save writes to both localStorage (for offline speed) and server (for persistence). On login, fetch from server and merge into localStorage.
- **Conflict resolution:** Server wins if `updated_at` is newer. On first migration, if server has no data but localStorage does, push localStorage to server (one-time migration).
- **Migration:** On login, if server returns empty but localStorage has a profile for this userId, POST it to the server. Add a `migrated_at` flag to prevent re-migration.
- **Privacy:** Partner name and cycle start date are PII. Already encrypted in localStorage; should be stored encrypted-at-rest in MongoDB (default for Atlas).

### 2. Cycle History
- **Backend endpoint exists?** Yes — `POST/GET /api/cycle-history` in `server.py`
- **Database collection exists?** Yes — `cycle_history`
- **Should persist server-side?** Yes (core user data — loss means lost EWMA averages)
- **Key:** `user_id`
- **Sync strategy:** Write-through. Each `addCycleEntry()` also POSTs to server. On login, fetch from server.
- **Conflict resolution:** Merge by `cycle_start_date` — if a date exists in both local and server, keep the one with the most complete data (e.g., has `cycle_length` calculated). New entries from either side are additive.
- **Migration:** Same as partner profile — push localStorage entries to server on first login post-migration, keyed by `cycle_start_date` to prevent duplicates.
- **Privacy:** Cycle dates are health data. Same encryption-at-rest considerations.

### 3. Cycle Settings (luteal constant, menstrual length)
- **Backend endpoint exists?** No
- **Database collection exists?** No
- **Should persist server-side?** Yes (affects all predictions — losing these resets to defaults)
- **Key:** `user_id`
- **Sync strategy:** Store as a sub-document on the partner profile (not a separate collection). Read/write alongside partner profile.
- **Conflict resolution:** Server wins if newer.
- **Migration:** Push with partner profile migration.
- **Privacy:** Low sensitivity — just two integers.
- **New work needed:** Add `cycle_settings` field to partner profile schema.

### 4. Notification Preferences (phase reminders on/off, day1 check-in on/off)
- **Backend endpoint exists?** No
- **Database collection exists?** No
- **Should persist server-side?** Optional — these are device-specific preferences (notifications depend on the device's permission state). A user might want different settings on phone vs desktop.
- **Recommendation:** Keep local-only. These are UI preferences, not user data. If the user logs in on a new device, defaulting to ON is reasonable.
- **Key:** N/A (stays in localStorage)

### 5. Extension State (alert shown for current cycle)
- **Backend endpoint exists?** No
- **Database collection exists?** No
- **Should persist server-side?** No — this is transient per-cycle state that resets each cycle. It prevents duplicate alerts within a single cycle.
- **Recommendation:** Keep local-only.
- **Key:** N/A (stays in localStorage)

### 6. AI Wingman Chat History
- **Backend endpoint exists?** No (chat is stateless — each request is independent)
- **Database collection exists?** No
- **Should persist server-side?** Depends on product intent:
  - **Option A (recommended):** Persist server-side. Users expect chat history to survive across devices/sessions. Store in a `chat_history` collection keyed by `user_id`.
  - **Option B:** Keep local-only with a disclaimer that history is device-specific.
- **Key:** `user_id` + `session_id` (or just a flat list per user)
- **Sync strategy:** Append-only. Each message/response pair is POSTed to server. On login, fetch last N conversations.
- **Conflict resolution:** Append-only means no conflicts — each conversation has a unique timestamp.
- **Migration:** Push existing localStorage chat history to server on first login post-migration.
- **Privacy:** Chat content may contain sensitive relationship information. Should be encrypted at rest. Consider a retention policy (e.g., auto-delete after 90 days).

---

## Summary Table

| Data Type | Persist Server-Side? | Endpoint Exists? | Collection Exists? | New Work |
|---|---|---|---|---|
| Partner Profile | Yes | Yes | Yes | Wire frontend to existing API |
| Cycle History | Yes | Yes | Yes | Wire frontend to existing API |
| Cycle Settings | Yes | No | No (embed in profile) | Add field to profile schema + API |
| Notification Prefs | No (device-specific) | — | — | None |
| Extension State | No (transient) | — | — | None |
| Chat History | Yes (recommended) | No | No | New API + collection |

---

## Implementation Stages

### Stage 1: Partner Profile + Cycle History (highest impact)
- Wire Dashboard to POST/GET from existing backend APIs alongside localStorage
- Add migration logic on login (push local → server if server empty)
- Both APIs and collections already exist — minimal backend work

### Stage 2: Cycle Settings
- Add `cycle_settings` sub-document to partner profile
- Update partner profile API to include it
- Update frontend to sync settings with profile saves

### Stage 3: Chat History (if desired)
- Create `chat_history` collection and API endpoints
- Modify AI Wingman tab to persist conversations
- Add fetch-on-login for recent conversations

### Stage 4: Cleanup
- Remove `clearAllData()` function entirely (no longer needed)
- Add server-side data export/delete for GDPR/CCPA compliance
- Add data retention policies for chat history

---

## Security / Privacy Considerations
- All server-side data keyed to `user_id` from authenticated session — no cross-user access
- Health data (cycle dates, partner info) subject to privacy regulations
- MongoDB Atlas encryption-at-rest covers storage
- HTTPS covers transit
- Chat history retention policy recommended (90 days suggested)
- User data export and deletion APIs needed for compliance (can be admin-triggered initially)

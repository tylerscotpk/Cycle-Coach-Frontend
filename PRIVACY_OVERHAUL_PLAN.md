# Do Her Better - Privacy Overhaul Plan

## Executive Summary

This document outlines a comprehensive privacy overhaul for "Do Her Better" to address critical security and legal concerns around reproductive health data tracking.

---

## Current Privacy Issues (CRITICAL)

### 🔴 **Severity: CRITICAL - Legal & Safety Risks**

1. **User Identity Exposure**
   - Google OAuth links real identity (email, name, Google ID) to all cycle data
   - Can be subpoenaed in states with restrictive reproductive laws
   - No anonymity layer

2. **AI Data Leakage**
   - ✅ **FIXED (Partial)**: Removed partner names from AI prompts
   - ✅ **FIXED (Partial)**: Anonymized session IDs using hashed values
   - ⚠️ **REMAINING**: Preferences still sent to OpenAI (less sensitive but still trackable)
   - ⚠️ **REMAINING**: Conversation history stored in DB with user_id

3. **Database Security**
   - All data stored with user_id linkage
   - No encryption at rest
   - Partner names stored in plain text
   - Cycle history permanently linked to Google accounts

4. **No Partner Consent Mechanism**
   - No verification that partner consents to tracking
   - Ethical and legal liability

5. **Frontend Security**
   - React app could be vulnerable to XSS attacks
   - No CSRF protection on API calls
   - Potential for request forgery

---

## Immediate Actions Taken (Today)

### ✅ **1. Privacy Warning Added**
- Prominent orange warning banner on landing page
- Warns about:
  - Legal subpoena risks
  - Need for partner consent
  - Data collection practices
  - AI processing

### ✅ **2. AI Request Anonymization (Partial)**
- Session IDs now hashed (anonymous)
- Partner names removed from AI prompts
- Generic language used instead of identifiable info

---

## Recommended Privacy Architecture Options

### **Option A: Local-Only Mode (MOST PRIVATE)**

**Implementation:**
- Remove all backend authentication
- Store ALL data in browser localStorage
- No server-side user accounts
- AI requests fully anonymized (no session persistence)

**Pros:**
- ✅ Complete anonymity
- ✅ No subpoena-able server data
- ✅ User has full control
- ✅ No breach risk (no central DB)

**Cons:**
- ❌ Data lost if browser cache cleared
- ❌ No cross-device sync
- ❌ Can't use push notifications
- ❌ No chat history persistence

**Implementation Steps:**
1. Create localStorage wrapper for all data operations
2. Remove Google OAuth dependency
3. Implement client-side data encryption
4. Add export/import functionality for backups
5. Modify AI chat to not persist history
6. Add "Clear All Data" button prominently

**Estimated Dev Time:** 2-3 days

---

### **Option B: Pseudonymous Accounts (MIDDLE GROUND)**

**Implementation:**
- Replace Google OAuth with email/password
- Generate random UUID for user accounts (no emails in DB)
- Encrypt all sensitive data at rest
- No partner names stored (use "Partner A", "Partner B")
- Zero-knowledge architecture where possible

**Pros:**
- ✅ Cross-device sync
- ✅ Push notifications possible
- ✅ Chat history maintained
- ✅ Better than current state
- ⚠️ Still somewhat linkable

**Cons:**
- ❌ Server still has data
- ❌ Can be subpoenaed (though harder to link)
- ❌ Requires trust in server operator

**Implementation Steps:**
1. Build email/password auth system
2. Replace user_id with random UUIDs
3. Implement AES encryption for all profile data
4. Remove all name fields
5. Add data deletion workflow
6. Implement "Export Your Data" feature
7. Add transparent privacy policy

**Estimated Dev Time:** 5-7 days

---

### **Option C: Hybrid (RECOMMENDED)**

**Implementation:**
- Default to Local-Only Mode
- Optional cloud backup with pseudonymous accounts
- User chooses privacy level

**Pros:**
- ✅ Best of both worlds
- ✅ User controls their risk
- ✅ Maximum flexibility
- ✅ Appeals to privacy-conscious users

**Cons:**
- ❌ Most complex to build
- ❌ Two systems to maintain

**Implementation Steps:**
1. Build Local-Only Mode first (Option A)
2. Add optional "Cloud Backup" feature (Option B)
3. Make it clear which data goes where
4. Default to local-only
5. Require explicit opt-in for cloud features

**Estimated Dev Time:** 7-10 days

---

## Additional Privacy Improvements

### **Frontend Security Hardening**

1. **CSRF Protection**
   - Add CSRF tokens to all API requests
   - Validate origin headers

2. **XSS Prevention**
   - Sanitize all user inputs
   - Use Content Security Policy headers
   - Escape all rendered user data

3. **API Request Validation**
   - Rate limiting on all endpoints
   - Input validation and sanitization
   - JWT token expiration enforcement

**Estimated Dev Time:** 2-3 days

---

### **Backend Security Hardening**

1. **Data Encryption**
   - Encrypt all PII at rest (AES-256)
   - Use separate encryption keys per user
   - Store encryption keys in secure vault (not in code)

2. **Access Logging**
   - Log all data access (for breach detection)
   - Automatic alerts for suspicious patterns
   - NO IP address logging (anonymize)

3. **Database Security**
   - Restrict MongoDB to internal network only
   - Enable authentication
   - Regular automated backups (encrypted)
   - Implement data retention policies

4. **API Hardening**
   - Implement proper CORS policies
   - Add request signature verification
   - Rate limiting per user/IP

**Estimated Dev Time:** 4-5 days

---

### **Partner Consent System**

**Implementation:**
1. Add consent checkbox on partner profile creation
2. Require re-consent every 90 days
3. Add "Revoke Consent" button that deletes all data
4. Log consent timestamps (for legal protection)

**UI Flow:**
```
Before tracking any cycle data:
┌─────────────────────────────────────────┐
│  ⚠️ Partner Consent Required            │
│                                         │
│  Have you discussed this app with your  │
│  partner and obtained their explicit    │
│  consent to track their cycle?          │
│                                         │
│  [ ] Yes, I have their consent          │
│  [ ] No, I'll ask them first            │
│                                         │
│  [Continue]  [Learn More]               │
└─────────────────────────────────────────┘
```

**Estimated Dev Time:** 1 day

---

### **Privacy Policy & Terms**

**Must Include:**
- Data collection practices
- Third-party data sharing (OpenAI)
- Government subpoena policy
- Data retention and deletion
- Partner consent requirements
- User rights (export, delete)
- Contact for privacy questions

**Estimated Dev Time:** 1 day (legal review recommended)

---

## Compliance Considerations

### **GDPR (Europe)**
- Right to access data
- Right to delete data
- Right to data portability
- Consent management

### **CCPA (California)**
- Disclosure of data collection
- Opt-out of data sales
- Data deletion rights

### **HIPAA (Healthcare - May Apply)**
- Protected Health Information (PHI) rules
- May apply if marketed as health tracking
- Requires Business Associate Agreements with OpenAI

**⚠️ Legal consultation strongly recommended**

---

## Immediate Action Items (This Week)

### **Priority 1: Critical Fixes**
- ✅ Privacy warning on landing page (DONE)
- ✅ Anonymize AI requests (DONE - Partial)
- ⬜ Add partner consent flow
- ⬜ Add "Delete All My Data" button

### **Priority 2: Choose Architecture**
- ⬜ User decision: Which option? (A, B, or C)
- ⬜ Begin implementation based on choice

### **Priority 3: Security Hardening**
- ⬜ Implement CSRF protection
- ⬜ Add data encryption at rest
- ⬜ Secure MongoDB configuration

---

## Testing & Validation

### **Security Testing Needed:**
1. Penetration testing (API endpoints)
2. XSS/CSRF vulnerability scanning
3. Database access audit
4. SSL/TLS configuration check
5. Privacy policy legal review

### **User Testing:**
1. Privacy controls usability
2. Data export/delete workflows
3. Consent flow clarity

---

## Cost Implications

### **Development Costs:**
- Option A (Local-Only): ~$3-5K (2-3 days @ $150/hr)
- Option B (Pseudonymous): ~$7-10K (5-7 days)
- Option C (Hybrid): ~$10-15K (7-10 days)
- Security Hardening: ~$3-5K (2-3 days)
- Legal Review: ~$2-5K

### **Ongoing Costs:**
- Privacy compliance monitoring
- Security audits (annual): ~$5-10K
- Legal updates as laws change

---

## Recommendations

### **Immediate (This Week):**
1. ✅ Add privacy warnings (DONE)
2. ⬜ Implement partner consent flow
3. ⬜ Add "Delete My Data" feature

### **Short-term (Next 2 Weeks):**
1. ⬜ Choose architecture (Recommend Option C - Hybrid)
2. ⬜ Implement local-only mode as default
3. ⬜ Security hardening (CSRF, encryption)

### **Medium-term (Next Month):**
1. ⬜ Optional cloud backup feature
2. ⬜ Comprehensive security audit
3. ⬜ Legal review of privacy policy

### **Long-term (Ongoing):**
1. ⬜ Monitor privacy regulations
2. ⬜ Regular security updates
3. ⬜ User education on privacy best practices

---

## Key Takeaways

1. **Current State:** High privacy risk, legally exposed
2. **Immediate Fixes:** Warnings added, AI partially anonymized
3. **Recommended Path:** Hybrid local/cloud architecture
4. **Critical Need:** Partner consent system
5. **Legal Risk:** Requires professional legal review

---

## Questions for User/Stakeholder

1. **Which architecture do you prefer?**
   - Local-only (most private)
   - Pseudonymous cloud (middle ground)
   - Hybrid (recommended)

2. **Target launch timeline?**
   - This affects how much we can implement

3. **Budget for legal review?**
   - Strongly recommended for reproductive health data

4. **Risk tolerance?**
   - How much legal exposure are you comfortable with?

5. **User experience priorities?**
   - Privacy vs. convenience tradeoffs

---

## Next Steps

**Awaiting your input on:**
1. Architecture choice (A, B, or C)
2. Implementation timeline
3. Budget allocation
4. Legal consultation plans

Once decided, I can begin implementation immediately.

---

**Document Version:** 1.0  
**Date:** December 2, 2024  
**Author:** E1 Development Agent  
**Status:** Awaiting User Decision

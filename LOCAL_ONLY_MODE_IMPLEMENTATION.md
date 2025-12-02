# Local-Only Mode Implementation Guide

## Overview
This document outlines how to implement a privacy-first, local-only version of "Do Her Better" where ALL data stays on the user's device.

---

## Architecture Changes

### **Current Architecture:**
```
User → Google OAuth → Backend API → MongoDB
                    ↓
                OpenAI GPT-5 (with user data)
```

### **Local-Only Architecture:**
```
User → Local Browser Storage (encrypted)
     → Direct OpenAI API (anonymized, no persistence)
```

---

## Implementation Steps

### **Phase 1: Frontend Storage Layer**

#### 1.1 Create LocalStorage Manager
File: `/app/frontend/src/utils/localStorageManager.js`

```javascript
// Encryption helpers
const encrypt = (data, password = 'user-device-key') => {
  // Use Web Crypto API for encryption
  return btoa(JSON.stringify(data)); // Simplified - use proper encryption
};

const decrypt = (encryptedData, password = 'user-device-key') => {
  return JSON.parse(atob(encryptedData));
};

export const LocalStorage = {
  // Partner Profile
  savePartnerProfile: (profile) => {
    const encrypted = encrypt(profile);
    localStorage.setItem('partner_profile', encrypted);
  },
  
  getPartnerProfile: () => {
    const data = localStorage.getItem('partner_profile');
    return data ? decrypt(data) : null;
  },
  
  // Cycle History
  saveCycleHistory: (history) => {
    const encrypted = encrypt(history);
    localStorage.setItem('cycle_history', encrypted);
  },
  
  getCycleHistory: () => {
    const data = localStorage.getItem('cycle_history');
    return data ? decrypt(data) : [];
  },
  
  // Add cycle entry
  addCycleEntry: (entry) => {
    const history = LocalStorage.getCycleHistory();
    history.push(entry);
    LocalStorage.saveCycleHistory(history);
  },
  
  // Delete cycle entry
  deleteCycleEntry: (entryId) => {
    const history = LocalStorage.getCycleHistory();
    const filtered = history.filter(e => e.id !== entryId);
    LocalStorage.saveCycleHistory(filtered);
  },
  
  // Preferences
  savePreferences: (prefs) => {
    const encrypted = encrypt(prefs);
    localStorage.setItem('preferences', encrypted);
  },
  
  getPreferences: () => {
    const data = localStorage.getItem('preferences');
    return data ? decrypt(data) : {};
  },
  
  // Clear all data
  clearAllData: () => {
    localStorage.removeItem('partner_profile');
    localStorage.removeItem('cycle_history');
    localStorage.removeItem('preferences');
    localStorage.removeItem('chat_history');
  },
  
  // Export data (for backup)
  exportAllData: () => {
    return {
      profile: LocalStorage.getPartnerProfile(),
      history: LocalStorage.getCycleHistory(),
      preferences: LocalStorage.getPreferences(),
      exportDate: new Date().toISOString()
    };
  },
  
  // Import data (from backup)
  importData: (data) => {
    if (data.profile) LocalStorage.savePartnerProfile(data.profile);
    if (data.history) LocalStorage.saveCycleHistory(data.history);
    if (data.preferences) LocalStorage.savePreferences(data.preferences);
  }
};
```

#### 1.2 Client-Side Cycle Calculations
File: `/app/frontend/src/utils/cycleCalculations.js`

```javascript
export const calculateCycleDay = (startDate, cycleLength = 28) => {
  const start = new Date(startDate);
  const today = new Date();
  const daysSinceStart = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  return (daysSinceStart % cycleLength) + 1;
};

export const getPhaseInfo = (cycleDay) => {
  // Same logic as backend get_phase_info
  if (cycleDay >= 1 && cycleDay <= 5) {
    return {
      phase: "Menstrual",
      phaseNumber: 1,
      phaseDay: cycleDay,
      // ... rest of phase info
    };
  }
  // ... other phases
};

export const recalculateCycleLengths = (history) => {
  // Sort by date
  const sorted = history.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Calculate lengths
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = new Date(sorted[i].date);
    const next = new Date(sorted[i + 1].date);
    const days = Math.floor((next - current) / (1000 * 60 * 60 * 24));
    sorted[i].length = days;
    sorted[i].status = 'completed';
  }
  
  // Mark last as current
  if (sorted.length > 0) {
    sorted[sorted.length - 1].length = null;
    sorted[sorted.length - 1].status = 'current';
  }
  
  return sorted;
};
```

#### 1.3 Anonymous AI Chat (Client-Side)
File: `/app/frontend/src/utils/anonymousAI.js`

```javascript
export const sendAnonymousChat = async (message, cycleContext) => {
  // Call OpenAI directly from frontend (requires API key in .env)
  // OR call a lightweight anonymization proxy
  
  const anonymousPrompt = `
You're a relationship advisor. Current context:
- Cycle Day: ${cycleContext.day}
- Phase: ${cycleContext.phase}

User message: ${message}

Respond with helpful, direct advice.
  `;
  
  // Note: In production, this would call a privacy-preserving proxy
  // that adds no logging and doesn't persist conversations
  
  const response = await fetch('/api/anonymous-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: anonymousPrompt,
      noLogging: true
    })
  });
  
  return await response.json();
};
```

---

### **Phase 2: UI Updates**

#### 2.1 Remove Google OAuth
- Replace login button with "Start Using (No Account Needed)"
- Show privacy benefits: "All data stays on YOUR device"

#### 2.2 Add Privacy Controls Page
File: `/app/frontend/src/pages/PrivacySettings.jsx`

```jsx
import { LocalStorage } from '../utils/localStorageManager';

const PrivacySettings = () => {
  const handleExport = () => {
    const data = LocalStorage.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `do-her-better-backup-${Date.now()}.json`;
    a.click();
  };
  
  const handleImport = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = JSON.parse(e.target.result);
      LocalStorage.importData(data);
      alert('Data imported successfully!');
    };
    reader.readAsText(file);
  };
  
  const handleClearAll = () => {
    if (confirm('Delete ALL data? This cannot be undone!')) {
      LocalStorage.clearAllData();
      window.location.href = '/';
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Privacy & Data</h1>
      
      <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg mb-6">
        <p className="text-green-300">
          ✅ All your data is stored ONLY on this device
          <br/>
          ✅ No server, no account, no tracking
          <br/>
          ✅ You have complete control
        </p>
      </div>
      
      <div className="space-y-4">
        <button onClick={handleExport} className="btn btn-primary w-full">
          📥 Export My Data (Backup)
        </button>
        
        <label className="btn btn-secondary w-full cursor-pointer">
          📤 Import Data (Restore)
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
        
        <button onClick={handleClearAll} className="btn btn-danger w-full">
          🗑️ Delete All My Data
        </button>
      </div>
      
      <div className="mt-8 text-sm text-slate-400">
        <h3 className="font-bold mb-2">What's stored:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Partner cycle dates</li>
          <li>Preferences you've entered</li>
          <li>Cycle history</li>
        </ul>
        <p className="mt-4">
          <strong>What's NOT stored:</strong> Your identity, chat history, any personally identifiable information.
        </p>
      </div>
    </div>
  );
};

export default PrivacySettings;
```

#### 2.3 Update Dashboard to Use LocalStorage

Replace all API calls with LocalStorage calls:

```jsx
// OLD: Fetch from API
const loadCycleInfo = async () => {
  const response = await axios.get(`${API}/cycle/current`);
  setCycleInfo(response.data);
};

// NEW: Load from LocalStorage
const loadCycleInfo = () => {
  const profile = LocalStorage.getPartnerProfile();
  if (profile) {
    const cycleDay = calculateCycleDay(profile.cycleStartDate, profile.cycleLength);
    const phaseInfo = getPhaseInfo(cycleDay);
    setCycleInfo({ ...phaseInfo, cycleDay });
  }
};
```

---

### **Phase 3: Backend Simplification**

#### 3.1 Remove User Authentication
- Delete Google OAuth routes
- Keep only anonymous AI proxy endpoint

#### 3.2 Anonymous Chat Proxy
File: `/app/backend/anonymous_server.py`

```python
from fastapi import FastAPI
from pydantic import BaseModel
import hashlib
from emergentintegrations import LlmChat, UserMessage

app = FastAPI()

class AnonymousChat(BaseModel):
    prompt: str
    noLogging: bool = True

@app.post("/api/anonymous-chat")
async def anonymous_chat(chat: AnonymousChat):
    """
    Privacy-first AI chat endpoint
    - No user identification
    - No conversation persistence
    - No logging
    """
    
    # Generate truly random session ID (not linked to user)
    import secrets
    session_id = f"anon_{secrets.token_hex(8)}"
    
    # Create ephemeral chat (no history)
    ai_chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message="You are a helpful relationship advisor. Provide direct, actionable advice."
    ).with_model("openai", "gpt-5")
    
    # Send message
    response = await ai_chat.send_message(UserMessage(text=chat.prompt))
    
    # Do NOT save conversation to database
    
    return {"response": response}
```

---

### **Phase 4: Privacy Enhancements**

#### 4.1 Browser Storage Encryption
Use Web Crypto API for proper encryption:

```javascript
import { subtle } from 'crypto';

const deriveKey = async (password) => {
  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  
  return await subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("do-her-better-salt"), // In production, use random salt per user
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

export const encryptData = async (data, password = "device-key") => {
  const key = await deriveKey(password);
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(data))
  );
  
  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  };
};

export const decryptData = async (encryptedObj, password = "device-key") => {
  const key = await deriveKey(password);
  const decrypted = await subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(encryptedObj.iv) },
    key,
    new Uint8Array(encryptedObj.data)
  );
  
  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decrypted));
};
```

#### 4.2 Data Retention Warning
Add banner when localStorage is getting full:

```jsx
useEffect(() => {
  const checkStorage = () => {
    const used = new Blob(Object.values(localStorage)).size;
    const limit = 5 * 1024 * 1024; // 5MB typical limit
    
    if (used > limit * 0.8) {
      toast.warning('Storage almost full. Consider exporting and clearing old data.');
    }
  };
  
  checkStorage();
}, []);
```

---

## Migration Path (Current Users → Local-Only)

### Option 1: Export Tool
```jsx
const MigrationTool = () => {
  const handleExportFromServer = async () => {
    // Call current API to get all user data
    const userData = await axios.get(`${API}/export-my-data`);
    
    // Save to localStorage
    LocalStorage.importData(userData.data);
    
    // Prompt user to delete server data
    alert('Data imported! Now delete your server account for full privacy.');
  };
  
  return <button onClick={handleExportFromServer}>Migrate to Local-Only</button>;
};
```

### Option 2: Side-by-Side
- Run both versions
- Let users choose
- Gradual transition

---

## Benefits of Local-Only Mode

### ✅ **Privacy**
- No server-side user data
- No subpoena risk
- No data breaches possible
- Complete user control

### ✅ **Security**
- Encrypted at rest (in browser)
- No network transmission of sensitive data
- No authentication vulnerabilities

### ✅ **Legal**
- No GDPR compliance needed (no data collection)
- No HIPAA concerns
- No data retention liabilities

### ✅ **Performance**
- Instant load times
- Works offline
- No API latency

---

## Limitations of Local-Only Mode

### ❌ **User Experience**
- Data lost if browser cache cleared
- No cross-device sync
- No cloud backup
- Manual export/import required

### ❌ **Features**
- No push notifications
- No chat history persistence
- No advanced analytics

### ❌ **Development**
- More complex frontend logic
- Client-side calculations required
- Less usage analytics

---

## Deployment Plan

### **Week 1:**
- Build localStorage manager
- Implement client-side calculations
- Update Dashboard to use local data

### **Week 2:**
- Build Privacy Settings page
- Add export/import functionality
- Remove Google OAuth dependencies

### **Week 3:**
- Test thoroughly
- Build migration tool for existing users
- Update landing page messaging

### **Week 4:**
- Deploy local-only version
- Monitor for issues
- Collect user feedback

---

## Testing Checklist

- [ ] Data persists across page reloads
- [ ] Data survives browser restart
- [ ] Export creates valid JSON
- [ ] Import restores all data correctly
- [ ] Delete all data works completely
- [ ] Encryption/decryption is working
- [ ] Cycle calculations match server version
- [ ] Phase info displays correctly
- [ ] No data sent to server (network tab check)
- [ ] Works in incognito mode
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari)

---

## Future Enhancements

### **Optional Cloud Sync (With Consent)**
- Add opt-in encrypted cloud backup
- Use zero-knowledge architecture
- User controls encryption key

### **PWA (Progressive Web App)**
- Install as standalone app
- Better offline support
- More native feel

### **Advanced Encryption**
- User-set password for encryption
- Hardware security key support
- Biometric unlock

---

## Documentation for Users

### FAQ to Add:

**Q: Where is my data stored?**
A: 100% on YOUR device. We never see it.

**Q: What if I clear my browser data?**
A: Your data will be lost. Export regularly as backup!

**Q: Can I sync across devices?**
A: Not in local-only mode. This is for maximum privacy.

**Q: Is this really private?**
A: Yes. Since we never have your data, we can't give it to anyone - even if legally required.

**Q: How do I backup my data?**
A: Go to Settings → Export Data. Save the file somewhere safe.

---

## Conclusion

Local-only mode is the **most privacy-preserving option** but requires user education about backups and limitations. It's perfect for privacy-conscious users in restrictive legal environments.

**Recommendation:** Start with this as default, then offer optional cloud features for users who want convenience over maximum privacy.

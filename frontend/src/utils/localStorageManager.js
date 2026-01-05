/**
 * Privacy-First Local Storage Manager
 * All data stays on user's device - no server, no tracking
 */

// Simple encryption (in production, use Web Crypto API)
const encrypt = (data) => {
  try {
    return btoa(JSON.stringify(data));
  } catch (e) {
    console.error('Encryption failed:', e);
    return null;
  }
};

const decrypt = (encryptedData) => {
  try {
    return JSON.parse(atob(encryptedData));
  } catch (e) {
    console.error('Decryption failed:', e);
    return null;
  }
};

export const LocalStorage = {
  // Partner Profile
  savePartnerProfile: (profile) => {
    const encrypted = encrypt(profile);
    if (encrypted) {
      localStorage.setItem('cyclecoach_partner_profile', encrypted);
    }
  },
  
  getPartnerProfile: () => {
    const data = localStorage.getItem('cyclecoach_partner_profile');
    return data ? decrypt(data) : null;
  },
  
  // Cycle History
  saveCycleHistory: (history) => {
    const encrypted = encrypt(history);
    if (encrypted) {
      localStorage.setItem('cyclecoach_cycle_history', encrypted);
    }
  },
  
  getCycleHistory: () => {
    const data = localStorage.getItem('cyclecoach_cycle_history');
    return data ? decrypt(data) : [];
  },
  
  // Add cycle entry
  addCycleEntry: (entry) => {
    const history = LocalStorage.getCycleHistory();
    history.push({
      ...entry,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    });
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
    if (encrypted) {
      localStorage.setItem('cyclecoach_preferences', encrypted);
    }
  },
  
  getPreferences: () => {
    const data = localStorage.getItem('cyclecoach_preferences');
    return data ? decrypt(data) : {};
  },
  
  // Partner Consent
  saveConsent: (consent) => {
    const consentRecord = {
      granted: consent,
      timestamp: new Date().toISOString(),
      acknowledgedRisks: true
    };
    const encrypted = encrypt(consentRecord);
    if (encrypted) {
      localStorage.setItem('cyclecoach_consent', encrypted);
    }
  },
  
  getConsent: () => {
    const data = localStorage.getItem('cyclecoach_consent');
    return data ? decrypt(data) : null;
  },
  
  // Clear all data
  clearAllData: () => {
    localStorage.removeItem('cyclecoach_partner_profile');
    localStorage.removeItem('cyclecoach_cycle_history');
    localStorage.removeItem('cyclecoach_preferences');
    localStorage.removeItem('cyclecoach_consent');
    localStorage.removeItem('cyclecoach_chat_history');
    localStorage.removeItem('cyclecoach_license');
  },
  
  // License Key Management
  saveLicenseKey: (key) => {
    const licenseData = {
      key: key,
      activatedAt: new Date().toISOString(),
      isValid: true
    };
    const encrypted = encrypt(licenseData);
    if (encrypted) {
      localStorage.setItem('cyclecoach_license', encrypted);
    }
  },
  
  getLicenseKey: () => {
    const data = localStorage.getItem('cyclecoach_license');
    return data ? decrypt(data) : null;
  },
  
  isUnlocked: () => {
    const license = localStorage.getItem('cyclecoach_license');
    if (!license) return false;
    const data = decrypt(license);
    return data?.isValid === true;
  },
  
  // Export data (for backup)
  exportAllData: () => {
    return {
      profile: LocalStorage.getPartnerProfile(),
      history: LocalStorage.getCycleHistory(),
      preferences: LocalStorage.getPreferences(),
      consent: LocalStorage.getConsent(),
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  },
  
  // Import data (from backup)
  importData: (data) => {
    if (data.profile) LocalStorage.savePartnerProfile(data.profile);
    if (data.history) LocalStorage.saveCycleHistory(data.history);
    if (data.preferences) LocalStorage.savePreferences(data.preferences);
    if (data.consent) LocalStorage.saveConsent(data.consent.granted);
  }
};

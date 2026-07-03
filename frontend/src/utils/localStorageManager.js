/**
 * Privacy-First Local Storage Manager
 * All data stays on user's device — namespaced per user ID for data isolation.
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

// Internal user ID for key namespacing
let _userId = null;

const _key = (name) => {
  if (!_userId) {
    // Try to read userId from the 'user' object in localStorage
    try {
      const raw = localStorage.getItem('user');
      if (raw) _userId = JSON.parse(raw).id;
    } catch {}
  }
  return _userId ? `cyclecoach_${name}_${_userId}` : `cyclecoach_${name}`;
};

// Old un-namespaced key (for migration)
const _oldKey = (name) => `cyclecoach_${name}`;

// All managed key suffixes
const ALL_KEYS = [
  'partner_profile', 'cycle_history', 'preferences', 'consent',
  'chat_history', 'license', 'subscription', 'location',
  'notification_settings', 'extension_state',
];

// Migrate data from old un-namespaced keys to new namespaced keys
const _migrateIfNeeded = () => {
  if (!_userId) return;
  const migrationFlag = `cyclecoach_migrated_${_userId}`;
  if (localStorage.getItem(migrationFlag)) return;

  for (const suffix of ALL_KEYS) {
    const oldK = _oldKey(suffix);
    const newK = _key(suffix);
    const oldData = localStorage.getItem(oldK);
    const newData = localStorage.getItem(newK);
    // Only migrate if old data exists and new data doesn't
    if (oldData && !newData) {
      localStorage.setItem(newK, oldData);
    }
  }
  // Also migrate non-encrypted keys
  const boolKeys = ['cyclecoach_state_waiver_complete', 'cyclecoach_consent_granted'];
  for (const k of boolKeys) {
    const old = localStorage.getItem(k);
    if (old && !localStorage.getItem(`${k}_${_userId}`)) {
      localStorage.setItem(`${k}_${_userId}`, old);
    }
  }

  localStorage.setItem(migrationFlag, 'true');
};

export const LocalStorage = {
  // Initialize with user ID — call on login/auth check
  setUser: (userId) => {
    _userId = userId;
    _migrateIfNeeded();
  },

  getUserId: () => _userId,

  // Partner Profile
  savePartnerProfile: (profile) => {
    const encrypted = encrypt(profile);
    if (encrypted) localStorage.setItem(_key('partner_profile'), encrypted);
  },

  getPartnerProfile: () => {
    const data = localStorage.getItem(_key('partner_profile'));
    return data ? decrypt(data) : null;
  },

  // Cycle History
  saveCycleHistory: (history) => {
    const encrypted = encrypt(history);
    if (encrypted) localStorage.setItem(_key('cycle_history'), encrypted);
  },

  getCycleHistory: () => {
    const data = localStorage.getItem(_key('cycle_history'));
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
    if (encrypted) localStorage.setItem(_key('preferences'), encrypted);
  },

  getPreferences: () => {
    const data = localStorage.getItem(_key('preferences'));
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
    if (encrypted) localStorage.setItem(_key('consent'), encrypted);
  },

  getConsent: () => {
    const data = localStorage.getItem(_key('consent'));
    return data ? decrypt(data) : null;
  },

  // Clear all data for current user
  clearAllData: () => {
    for (const suffix of ALL_KEYS) {
      localStorage.removeItem(_key(suffix));
    }
    // Also clear bool keys
    if (_userId) {
      localStorage.removeItem(`cyclecoach_state_waiver_complete_${_userId}`);
      localStorage.removeItem(`cyclecoach_consent_granted_${_userId}`);
      localStorage.removeItem(`cyclecoach_mismatch_tooltip_shown_${_userId}`);
      localStorage.removeItem(`cyclecoach_mismatch_tooltip_avg_${_userId}`);
      localStorage.removeItem(`cyclecoach_last_ewma_avg_${_userId}`);
      localStorage.removeItem(`cyclecoach_last_phase_notification_${_userId}`);
    }
  },

  // Clear everything on logout (user-specific data + session)
  clearOnLogout: () => {
    LocalStorage.clearAllData();
    localStorage.removeItem('session_token');
    localStorage.removeItem('user');
    localStorage.removeItem('pending_plan');
    _userId = null;
  },

  // User Location (for privacy waiver)
  saveUserLocation: (locationData) => {
    const encrypted = encrypt({
      location: locationData.location,
      state: locationData.state,
      savedAt: new Date().toISOString()
    });
    if (encrypted) localStorage.setItem(_key('location'), encrypted);
  },

  getUserLocation: () => {
    const data = localStorage.getItem(_key('location'));
    return data ? decrypt(data) : null;
  },

  hasCompletedLocationSetup: () => {
    return localStorage.getItem(_key('location')) !== null;
  },

  // Notification Settings
  saveNotificationSettings: (settings) => {
    const encrypted = encrypt({
      phaseReminders: settings.phaseReminders ?? true,
      reflectionPrompts: settings.reflectionPrompts ?? true,
      ratingPrompts: settings.ratingPrompts ?? true,
      savedAt: new Date().toISOString()
    });
    if (encrypted) localStorage.setItem(_key('notification_settings'), encrypted);
  },

  getNotificationSettings: () => {
    const data = localStorage.getItem(_key('notification_settings'));
    if (data) return decrypt(data);
    return { phaseReminders: true, reflectionPrompts: true, ratingPrompts: true };
  },

  // License Key Management
  saveLicenseKey: (key) => {
    const licenseData = {
      key: key,
      activatedAt: new Date().toISOString(),
      isValid: true
    };
    const encrypted = encrypt(licenseData);
    if (encrypted) localStorage.setItem(_key('license'), encrypted);
  },

  getLicenseKey: () => {
    const data = localStorage.getItem(_key('license'));
    return data ? decrypt(data) : null;
  },

  isUnlocked: () => {
    const license = localStorage.getItem(_key('license'));
    if (!license) return false;
    const data = decrypt(license);
    return data?.isValid === true;
  },

  // Subscription Tier Management
  saveSubscriptionTier: (tierData) => {
    const encrypted = encrypt({
      tier: tierData.tier,
      has_partner_profile: tierData.has_partner_profile,
      has_ai_wingman: tierData.has_ai_wingman,
      expires_at: tierData.expires_at,
      email: tierData.email,
      customer_id: tierData.customer_id,
      subscription_id: tierData.subscription_id,
      cancels_at: tierData.cancels_at,
      is_cancelled: tierData.is_cancelled,
      savedAt: new Date().toISOString()
    });
    if (encrypted) localStorage.setItem(_key('subscription'), encrypted);
  },

  getSubscriptionTier: () => {
    const data = localStorage.getItem(_key('subscription'));
    return data ? decrypt(data) : null;
  },

  hasPartnerProfile: () => {
    const tier = LocalStorage.getSubscriptionTier();
    return tier?.has_partner_profile === true;
  },

  hasAIWingman: () => {
    const tier = LocalStorage.getSubscriptionTier();
    return tier?.has_ai_wingman === true;
  },

  getTierName: () => {
    const tier = LocalStorage.getSubscriptionTier();
    if (!tier) return null;
    switch (tier.tier) {
      case 'premium': return 'Premium';
      case 'basic': return 'Basic';
      case 'grandfathered': return 'Lifetime';
      case 'free_trial': return 'Free Trial';
      default: return 'Free Trial';
    }
  },

  // Export data (for backup)
  exportAllData: () => {
    return {
      profile: LocalStorage.getPartnerProfile(),
      history: LocalStorage.getCycleHistory(),
      preferences: LocalStorage.getPreferences(),
      consent: LocalStorage.getConsent(),
      extensionState: LocalStorage.getExtensionState(),
      exportDate: new Date().toISOString(),
      version: '2.0'
    };
  },

  // Import data (from backup)
  importData: (data) => {
    if (data.profile) LocalStorage.savePartnerProfile(data.profile);
    if (data.history) LocalStorage.saveCycleHistory(data.history);
    if (data.preferences) LocalStorage.savePreferences(data.preferences);
    if (data.consent) LocalStorage.saveConsent(data.consent.granted);
    if (data.extensionState) LocalStorage.saveExtensionState(data.extensionState);
  },

  // Cycle Extension State
  saveExtensionState: (state) => {
    const encrypted = encrypt({
      confirmed: state.confirmed ?? null,
      alertShownForCycleStart: state.alertShownForCycleStart ?? null,
      cappedMessageShown: state.cappedMessageShown ?? false,
      updatedAt: new Date().toISOString()
    });
    if (encrypted) localStorage.setItem(_key('extension_state'), encrypted);
  },

  getExtensionState: () => {
    const data = localStorage.getItem(_key('extension_state'));
    return data ? decrypt(data) : null;
  },

  clearExtensionState: () => {
    localStorage.removeItem(_key('extension_state'));
  },

  // Chat history (for personalized tips)
  saveChatHistory: (history) => {
    localStorage.setItem(_key('chat_history'), JSON.stringify(history));
  },

  getChatHistory: () => {
    try {
      const data = localStorage.getItem(_key('chat_history'));
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  },
};

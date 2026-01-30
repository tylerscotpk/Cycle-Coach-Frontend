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
    localStorage.removeItem('cyclecoach_subscription');
    localStorage.removeItem('cyclecoach_location');
    localStorage.removeItem('cyclecoach_notification_settings');
  },
  
  // User Location (for privacy waiver)
  saveUserLocation: (locationData) => {
    const encrypted = encrypt({
      location: locationData.location,
      state: locationData.state,
      savedAt: new Date().toISOString()
    });
    if (encrypted) {
      localStorage.setItem('cyclecoach_location', encrypted);
    }
  },
  
  getUserLocation: () => {
    const data = localStorage.getItem('cyclecoach_location');
    return data ? decrypt(data) : null;
  },
  
  hasCompletedLocationSetup: () => {
    const location = localStorage.getItem('cyclecoach_location');
    return location !== null;
  },
  
  // Notification Settings
  saveNotificationSettings: (settings) => {
    const encrypted = encrypt({
      phaseReminders: settings.phaseReminders ?? true,
      reflectionPrompts: settings.reflectionPrompts ?? true,
      ratingPrompts: settings.ratingPrompts ?? true,
      savedAt: new Date().toISOString()
    });
    if (encrypted) {
      localStorage.setItem('cyclecoach_notification_settings', encrypted);
    }
  },
  
  getNotificationSettings: () => {
    const data = localStorage.getItem('cyclecoach_notification_settings');
    if (data) {
      return decrypt(data);
    }
    // Default: all notifications ON
    return {
      phaseReminders: true,
      reflectionPrompts: true,
      ratingPrompts: true
    };
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
    if (encrypted) {
      localStorage.setItem('cyclecoach_subscription', encrypted);
    }
  },
  
  getSubscriptionTier: () => {
    const data = localStorage.getItem('cyclecoach_subscription');
    return data ? decrypt(data) : null;
  },
  
  // Check if user has premium features
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

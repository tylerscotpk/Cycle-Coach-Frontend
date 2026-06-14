/**
 * Push Notification Service for Cycle Coach
 * Handles browser notifications for phase reminders and reflection prompts
 * All data stays local - no server-side notification storage
 */

import { LocalStorage } from './localStorageManager';
import { calculateCycleDay, getPhaseInfo, predictNextPeriod, recalculateCycleLengths, calculateStatistics, getCycleExtensionStatus } from './cycleCalculations';

// Check if notifications are supported
export const isNotificationsSupported = () => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if (!isNotificationsSupported()) {
    console.log('Notifications not supported');
    return 'unsupported';
  }

  const permission = await Notification.requestPermission();
  return permission; // 'granted', 'denied', or 'default'
};

// Get current notification permission status
export const getNotificationPermission = () => {
  if (!isNotificationsSupported()) return 'unsupported';
  return Notification.permission;
};

// Show a notification
export const showNotification = (title, options = {}) => {
  if (Notification.permission !== 'granted') {
    console.log('Notification permission not granted');
    return null;
  }

  const defaultOptions = {
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    ...options
  };

  return new Notification(title, defaultOptions);
};

// Get phase transition messages
const getPhaseTransitionMessage = (nextPhase) => {
  const messages = {
    'Menstrual': {
      title: "Heads up - Period incoming! 🔴",
      body: "Her period is likely starting tomorrow. Time to stock up on her favorites."
    },
    'Follicular': {
      title: "Storm's over - Follicular phase begins! 🌱",
      body: "She's about to feel more energetic. Great time to plan something fun."
    },
    'Ovulation': {
      title: "Prime time approaching! 🔥",
      body: "Ovulation phase starts tomorrow. Clear your schedule, champ."
    },
    'Early Luteal': {
      title: "Cozy mode incoming 🏠",
      body: "Early luteal phase tomorrow. She might prefer staying in."
    },
    'Late Luteal/PMS': {
      title: "PMS Alert - Tread carefully ⚠️",
      body: "Late luteal/PMS phase ahead. Stock up on comfort items."
    }
  };
  
  return messages[nextPhase] || { title: "Phase change coming", body: "Check the app for tips." };
};

// Get reflection prompt messages
const getReflectionPrompts = () => [
  { title: "Quick check-in 💬", body: "How did your date night go? Log what worked in the AI chat!" },
  { title: "What worked this week? 📝", body: "Spend 30 seconds telling the AI Wingman what she responded well to." },
  { title: "Reflection time 🤔", body: "What's one thing you noticed about her mood this cycle?" },
  { title: "Pro tip reminder 💡", body: "Ask the AI Wingman for movie suggestions based on her profile!" },
  { title: "Quick update? 📋", body: "Learned any new preferences? Update her Partner Profile!" }
];

// Check if we should show phase reminder (1 day before phase change)
export const checkPhaseReminder = () => {
  const settings = LocalStorage.getNotificationSettings();
  if (!settings.phaseReminders) return null;

  const profile = LocalStorage.getPartnerProfile();
  if (!profile?.cycleStartDate) return null;

  const history = LocalStorage.getCycleHistory();
  const recalculated = recalculateCycleLengths(history);
  const stats = calculateStatistics(recalculated);
  const cycleLength = stats.average_length || profile.cycleLength || 28;

  const cycleDay = calculateCycleDay(profile.cycleStartDate);
  const phaseInfo = getPhaseInfo(cycleDay, cycleLength);
  
  // Phase transition days (one day before next phase)
  const phaseEndDays = {
    'Menstrual': 5,
    'Follicular': 13,
    'Ovulation': 16,
    'Early Luteal': 23,
    'Late Luteal/PMS': cycleLength
  };

  const endDay = phaseEndDays[phaseInfo.phase];
  const daysUntilChange = endDay - cycleDay;

  // Only show notification 1 day before phase change
  if (daysUntilChange === 1) {
    const phases = ['Menstrual', 'Follicular', 'Ovulation', 'Early Luteal', 'Late Luteal/PMS'];
    const currentIndex = phases.indexOf(phaseInfo.phase);
    const nextPhase = phases[(currentIndex + 1) % phases.length];
    return getPhaseTransitionMessage(nextPhase);
  }

  return null;
};

// Check if we should show reflection prompt (random, ~once every 3-5 days)
export const checkReflectionPrompt = () => {
  const settings = LocalStorage.getNotificationSettings();
  if (!settings.reflectionPrompts) return null;

  // Check last prompt time
  const lastPrompt = localStorage.getItem('cyclecoach_last_reflection_prompt');
  const now = Date.now();
  
  if (lastPrompt) {
    const daysSinceLastPrompt = (now - parseInt(lastPrompt)) / (1000 * 60 * 60 * 24);
    // Only show every 3-5 days (random)
    const minDays = 3 + Math.random() * 2;
    if (daysSinceLastPrompt < minDays) return null;
  }

  // 20% chance to show on any given day check
  if (Math.random() > 0.2) return null;

  // Save the time of this prompt
  localStorage.setItem('cyclecoach_last_reflection_prompt', now.toString());

  const prompts = getReflectionPrompts();
  return prompts[Math.floor(Math.random() * prompts.length)];
};

// Schedule notification checks (call this on app load)
export const initializeNotifications = async () => {
  // Don't init if not supported
  if (!isNotificationsSupported()) {
    console.log('Notifications not supported on this device');
    return false;
  }

  // Check permission
  const permission = getNotificationPermission();
  if (permission === 'denied') {
    console.log('Notification permission denied');
    return false;
  }

  // If not yet asked, don't auto-ask (let user opt-in from settings)
  if (permission === 'default') {
    console.log('Notification permission not yet requested');
    return false;
  }

  return true;
};

// Check if we should show cycle extension notification (at average + 2)
export const checkExtensionAlert = () => {
  const settings = LocalStorage.getNotificationSettings();
  if (!settings.phaseReminders) return null;

  const profile = LocalStorage.getPartnerProfile();
  if (!profile?.cycleStartDate) return null;

  const history = LocalStorage.getCycleHistory();
  const recalculated = recalculateCycleLengths(history);
  const stats = calculateStatistics(recalculated);
  const avgLength = stats.ewma_length || stats.average_length || 28;

  const cycleDay = calculateCycleDay(profile.cycleStartDate);
  const status = getCycleExtensionStatus(cycleDay, avgLength);

  // Only fire at avg+2 and only once per cycle
  if (status === 'normal') return null;

  const extensionState = LocalStorage.getExtensionState();
  if (extensionState?.alertShownForCycleStart === profile.cycleStartDate) return null;

  // Mark alert as shown for this cycle
  LocalStorage.saveExtensionState({
    ...(extensionState || {}),
    alertShownForCycleStart: profile.cycleStartDate,
    confirmed: null
  });

  return {
    title: "Cycle extended — check in! 📋",
    body: `Day ${cycleDay} and counting. Periods can vary — confirm if her cycle has extended.`
  };
};

// Run notification checks (call periodically or on app focus)
export const runNotificationChecks = () => {
  // Don't run if permission not granted
  if (Notification.permission !== 'granted') return;

  // Check phase reminder
  const phaseReminder = checkPhaseReminder();
  if (phaseReminder) {
    const lastPhaseNotif = localStorage.getItem('cyclecoach_last_phase_notification');
    const today = new Date().toDateString();
    
    if (lastPhaseNotif !== today) {
      showNotification(phaseReminder.title, { body: phaseReminder.body });
      localStorage.setItem('cyclecoach_last_phase_notification', today);
    }
  }

  // Check extension alert
  const extensionAlert = checkExtensionAlert();
  if (extensionAlert) {
    showNotification(extensionAlert.title, { body: extensionAlert.body });
  }

  // Check reflection prompt
  const reflectionPrompt = checkReflectionPrompt();
  if (reflectionPrompt) {
    showNotification(reflectionPrompt.title, { body: reflectionPrompt.body });
  }
};

// Enable/disable notifications (request permission if needed)
export const enableNotifications = async () => {
  if (!isNotificationsSupported()) {
    return { success: false, message: 'Notifications not supported' };
  }

  const permission = await requestNotificationPermission();
  
  if (permission === 'granted') {
    return { success: true, message: 'Notifications enabled' };
  } else if (permission === 'denied') {
    return { 
      success: false, 
      message: 'Notifications blocked. Please enable in browser settings.' 
    };
  } else {
    return { success: false, message: 'Notification permission not granted' };
  }
};

// Get a test notification (for settings page)
export const sendTestNotification = () => {
  if (Notification.permission !== 'granted') {
    return false;
  }
  
  showNotification("Test notification! 🎉", {
    body: "Notifications are working. You'll get reminders before phase changes."
  });
  
  return true;
};

export default {
  isNotificationsSupported,
  requestNotificationPermission,
  getNotificationPermission,
  showNotification,
  checkPhaseReminder,
  checkReflectionPrompt,
  initializeNotifications,
  runNotificationChecks,
  enableNotifications,
  sendTestNotification
};

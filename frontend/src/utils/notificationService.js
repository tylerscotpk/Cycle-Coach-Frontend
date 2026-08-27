/**
 * Notification Service for Cycle Coach
 *
 * Native (iOS / Android via Capacitor):
 *   Schedules local notifications for future phase transitions.
 *   Cancels & reschedules when cycle data changes.
 *
 * Web fallback:
 *   Uses the browser Notification API on each app visit.
 *
 * Notification types:
 *   - Phase-change reminders (1 day before each transition) — on by default
 *   - Partner nudges (day a new phase starts) — off by default, independently toggleable
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { LocalStorage } from './localStorageManager';
import {
  calculateCycleDay,
  computePhaseBoundaries,
  recalculateCycleLengths,
  calculateStatistics,
  getCycleExtensionStatus,
  parseDateLocal,
} from './cycleCalculations';

// ── ID ranges (32-bit safe) ────────────────────────────────────────
const PHASE_REMINDER_IDS = [101, 102, 103, 104, 105];
const PARTNER_NUDGE_IDS  = [201, 202, 203, 204, 205];
const ALL_NOTIFICATION_IDS = [...PHASE_REMINDER_IDS, ...PARTNER_NUDGE_IDS];
const TEST_NOTIFICATION_ID = 999;

const NOTIFICATION_HOUR = 9; // schedule at 9 AM local

// ── Platform helpers ───────────────────────────────────────────────

export const isNativePlatform = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

export const isNotificationsSupported = () => {
  if (isNativePlatform()) return true;
  return 'Notification' in window;
};

// ── Permission ─────────────────────────────────────────────────────

/**
 * Returns: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unsupported'
 */
export const checkNotificationPermission = async () => {
  if (isNativePlatform()) {
    try {
      const r = await LocalNotifications.checkPermissions();
      return r.display;
    } catch { return 'denied'; }
  }
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission === 'default' ? 'prompt' : Notification.permission;
};

export const requestNotificationPermission = async () => {
  if (isNativePlatform()) {
    try {
      const r = await LocalNotifications.requestPermissions();
      return r.display;
    } catch { return 'denied'; }
  }
  if (!('Notification' in window)) return 'unsupported';
  const p = await Notification.requestPermission();
  return p === 'default' ? 'prompt' : p;
};

// ── Messages ───────────────────────────────────────────────────────

const PHASE_REMINDER_MESSAGES = {
  Follicular:        { title: "Follicular phase tomorrow",       body: "Energy is rising — great time to plan something fun together." },
  Ovulation:         { title: "Ovulation phase approaching",     body: "Her most social, confident phase starts tomorrow. Make plans." },
  'Early Luteal':    { title: "Luteal phase incoming",           body: "Energy dips after ovulation. Cozy nights in might be the move." },
  'Late Luteal/PMS': { title: "PMS phase ahead",                 body: "Sensitivity increases soon. Stock up on comfort items and patience." },
  Menstrual:         { title: "Period likely starting tomorrow",  body: "Her period is expected to begin. Time to be extra supportive." },
};

const PARTNER_NUDGE_MESSAGES = {
  Follicular:        { title: "Follicular phase started",             body: "She's gaining energy — suggest an outing or active date this week." },
  Ovulation:         { title: "Ovulation phase is here",              body: "Peak confidence and energy. Plan something memorable today." },
  'Early Luteal':    { title: "Luteal phase started",                 body: "Comfort mode activated. A thoughtful gesture goes a long way." },
  'Late Luteal/PMS': { title: "PMS phase has begun",                  body: "Extra patience and her favourite snacks. You've got this." },
  Menstrual:         { title: "Her period has started",               body: "Rest and warmth are key. Ask what she needs — don't assume." },
};

// ── Scheduling math ────────────────────────────────────────────────

const getTransitionDates = (cycleStartDate, avgLen, mLen, lConst) => {
  const b = computePhaseBoundaries(avgLen, mLen, lConst);
  const start = parseDateLocal(cycleStartDate);

  const transitions = [
    { phase: 'Follicular',        transDay: b.menstrualEnd + 1 },
    { phase: 'Ovulation',         transDay: b.follicularEnd + 1 },
    { phase: 'Early Luteal',      transDay: b.ovulationEnd + 1 },
    { phase: 'Late Luteal/PMS',   transDay: b.lutealEnd + 1 },
    { phase: 'Menstrual',         transDay: b.total + 1 },
  ];

  const now = new Date();

  return transitions.map(t => {
    const transDate = new Date(start);
    transDate.setDate(transDate.getDate() + t.transDay - 1);

    const reminder = new Date(transDate);
    reminder.setDate(reminder.getDate() - 1);
    reminder.setHours(NOTIFICATION_HOUR, 0, 0, 0);

    const nudge = new Date(transDate);
    nudge.setHours(NOTIFICATION_HOUR, 0, 0, 0);

    return { phase: t.phase, reminder, nudge, reminderFuture: reminder > now, nudgeFuture: nudge > now };
  });
};

// ── Native schedule / cancel ───────────────────────────────────────

export const cancelAllScheduled = async () => {
  if (!isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({
      notifications: ALL_NOTIFICATION_IDS.map(id => ({ id })),
    });
  } catch (e) { console.warn('Cancel notifications failed:', e); }
};

export const scheduleNativeNotifications = async () => {
  if (!isNativePlatform()) return;

  const perm = await checkNotificationPermission();
  if (perm !== 'granted') return;

  const settings = LocalStorage.getNotificationSettings();
  const profile  = LocalStorage.getPartnerProfile();
  if (!profile?.cycleStartDate) return;

  const history      = LocalStorage.getCycleHistory();
  const recalc       = recalculateCycleLengths(history);
  const stats        = calculateStatistics(recalc);
  const cs           = LocalStorage.getCycleSettings();
  const avgLen       = stats.ewma_length || stats.average_length || profile.cycleLength || 28;
  const mLen         = cs.menstrualLength || 5;
  const lConst       = cs.lutealConstant  || 14;

  await cancelAllScheduled();

  const transitions = getTransitionDates(profile.cycleStartDate, avgLen, mLen, lConst);
  const batch = [];

  transitions.forEach((t, i) => {
    if (settings.phaseReminders !== false && t.reminderFuture) {
      const m = PHASE_REMINDER_MESSAGES[t.phase];
      if (m) batch.push({
        id: PHASE_REMINDER_IDS[i],
        title: m.title,
        body: m.body,
        schedule: { at: t.reminder, allowWhileIdle: true },
        sound: 'default',
        smallIcon: 'ic_launcher',
      });
    }
    if (settings.partnerNudges && t.nudgeFuture) {
      const m = PARTNER_NUDGE_MESSAGES[t.phase];
      if (m) batch.push({
        id: PARTNER_NUDGE_IDS[i],
        title: m.title,
        body: m.body,
        schedule: { at: t.nudge, allowWhileIdle: true },
        sound: 'default',
        smallIcon: 'ic_launcher',
      });
    }
  });

  if (batch.length) {
    try {
      await LocalNotifications.schedule({ notifications: batch });
    } catch (e) { console.error('Schedule notifications failed:', e); }
  }
};

/**
 * Cancel obsolete + reschedule from current cycle data.
 * Call whenever cycle data or notification settings change.
 */
export const rescheduleNotifications = async () => {
  if (isNativePlatform()) await scheduleNativeNotifications();
};

// ── Web-only checks (run on visit / focus) ─────────────────────────

const showWebNotification = (title, opts = {}) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { icon: '/favicon.ico', badge: '/favicon.ico', vibrate: [200, 100, 200], ...opts });
};

export const runNotificationChecks = () => {
  if (isNativePlatform()) return; // native uses scheduled notifications
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const settings = LocalStorage.getNotificationSettings();
  const profile  = LocalStorage.getPartnerProfile();
  if (!profile?.cycleStartDate) return;

  const uid = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').id || ''; } catch { return ''; } })();
  const notifKey = uid ? `cyclecoach_last_phase_notification_${uid}` : 'cyclecoach_last_phase_notification';
  const today = new Date().toDateString();

  // Phase reminder — once per day
  if (settings.phaseReminders !== false && localStorage.getItem(notifKey) !== today) {
    const history  = LocalStorage.getCycleHistory();
    const recalc   = recalculateCycleLengths(history);
    const stats    = calculateStatistics(recalc);
    const cs       = LocalStorage.getCycleSettings();
    const avgLen   = stats.ewma_length || stats.average_length || profile.cycleLength || 28;
    const mLen     = cs.menstrualLength || 5;
    const lConst   = cs.lutealConstant  || 14;
    const cycleDay = calculateCycleDay(profile.cycleStartDate);
    const b        = computePhaseBoundaries(avgLen, mLen, lConst);

    const edges = [
      { day: b.menstrualEnd,   next: 'Follicular' },
      { day: b.follicularEnd,  next: 'Ovulation' },
      { day: b.ovulationEnd,   next: 'Early Luteal' },
      { day: b.lutealEnd,      next: 'Late Luteal/PMS' },
      { day: b.total,          next: 'Menstrual' },
    ];

    for (const e of edges) {
      if (cycleDay === e.day) {
        const m = PHASE_REMINDER_MESSAGES[e.next];
        if (m) { showWebNotification(m.title, { body: m.body }); localStorage.setItem(notifKey, today); }
        break;
      }
    }
  }

  // Extension alert (fires once per extended cycle)
  if (settings.phaseReminders !== false) {
    const history2 = LocalStorage.getCycleHistory();
    const recalc2  = recalculateCycleLengths(history2);
    const stats2   = calculateStatistics(recalc2);
    const avgLen2  = stats2.ewma_length || stats2.average_length || 28;
    const cycleDay = calculateCycleDay(profile.cycleStartDate);
    const status   = getCycleExtensionStatus(cycleDay, avgLen2);

    if (status !== 'normal') {
      const extState = LocalStorage.getExtensionState();
      if (extState?.alertShownForCycleStart !== profile.cycleStartDate) {
        LocalStorage.saveExtensionState({ ...(extState || {}), alertShownForCycleStart: profile.cycleStartDate, confirmed: null });
        showWebNotification('Cycle extended — check in', {
          body: `Day ${cycleDay} and counting. Periods can vary — confirm if her cycle has extended.`,
        });
      }
    }
  }
};

// ── Public API ──────────────────────────────────────────────────────

export const initializeNotifications = async () => {
  if (!isNotificationsSupported()) return false;
  const perm = await checkNotificationPermission();
  if (perm !== 'granted') return false;
  if (isNativePlatform()) await scheduleNativeNotifications();
  return true;
};

export const enableNotifications = async () => {
  if (!isNotificationsSupported()) return { success: false, message: 'Notifications not supported on this device' };
  const perm = await requestNotificationPermission();
  if (perm === 'granted') {
    if (isNativePlatform()) await scheduleNativeNotifications();
    return { success: true, message: 'Notifications enabled' };
  }
  if (perm === 'denied') return { success: false, message: 'Notifications blocked. Enable them in your device settings.' };
  return { success: false, message: 'Notification permission not granted' };
};

export const sendTestNotification = async () => {
  if (isNativePlatform()) {
    try {
      const perm = await checkNotificationPermission();
      if (perm !== 'granted') return false;
      await LocalNotifications.schedule({
        notifications: [{
          id: TEST_NOTIFICATION_ID,
          title: 'Test notification',
          body: "Notifications are working. You'll get reminders before phase changes.",
          schedule: { at: new Date(Date.now() + 1000) },
          sound: 'default',
          smallIcon: 'ic_launcher',
        }],
      });
      return true;
    } catch { return false; }
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  showWebNotification('Test notification', { body: "Notifications are working. You'll get reminders before phase changes." });
  return true;
};

// Legacy export kept for any remaining import
export const getNotificationPermission = () => {
  if (isNativePlatform()) return 'native';
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

export default {
  isNotificationsSupported,
  isNativePlatform,
  checkNotificationPermission,
  requestNotificationPermission,
  initializeNotifications,
  runNotificationChecks,
  enableNotifications,
  sendTestNotification,
  rescheduleNotifications,
  cancelAllScheduled,
};

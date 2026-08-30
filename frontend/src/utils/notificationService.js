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
 *   - Phase-change reminders (1 day before each transition) — ON by default
 *   - Day 1 Check-in (predicted period start — confirm or dismiss) — ON by default
 *   - Cycle extension alert (avg+2 days) — native + web
 *
 * All phase copy pulled from phaseContent.js — single source of truth.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { LocalStorage } from './localStorageManager';
import { PHASE_CONTENT } from './phaseContent';
import {
  calculateCycleDay,
  computePhaseBoundaries,
  recalculateCycleLengths,
  calculateStatistics,
  getCycleExtensionStatus,
  parseDateLocal,
} from './cycleCalculations';

// ── ID ranges (32-bit safe) ────────────────────────────────────────
const PHASE_REMINDER_IDS   = [101, 102, 103, 104, 105];
const DAY1_CHECKIN_ID      = 201;
const EXTENSION_ALERT_ID   = 301;
const TEST_NOTIFICATION_ID = 999;
const ALL_NOTIFICATION_IDS = [...PHASE_REMINDER_IDS, DAY1_CHECKIN_ID, EXTENSION_ALERT_ID];

const NOTIFICATION_HOUR = 9; // 9 AM local

// ── Phase transition order (matches cycleCalculations) ─────────────
// Each entry = the INCOMING phase after this boundary
const PHASE_KEYS_IN_ORDER = [
  'Follicular',        // after Menstrual
  'Ovulation',         // after Follicular
  'Early Luteal',      // after Ovulation  (display name: "Luteal")
  'Late Luteal/PMS',   // after Early Luteal (display name: "PMS")
  'Menstrual',         // next cycle
];

// ── Build reminder copy from phaseContent.js ───────────────────────
const buildReminderMessage = (phaseKey, isEstimate) => {
  const content = PHASE_CONTENT[phaseKey] || PHASE_CONTENT['Menstrual'];
  const displayName = content.name || phaseKey;
  const isperiod = phaseKey === 'Menstrual';

  const title = isperiod
    ? 'Period likely starting tomorrow'
    : `${displayName} phase tomorrow`;

  let body = content.planningTip || `Check the app for ${displayName} phase tips.`;
  if (isEstimate) body += ' (Estimated \u2014 no history yet)';

  return { title, body };
};

// ── Platform helpers ───────────────────────────────────────────────

export const isNativePlatform = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

export const isNotificationsSupported = () => {
  if (isNativePlatform()) return true;
  return 'Notification' in window;
};

// ── Permission ─────────────────────────────────────────────────────

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

// ── Scheduling math ────────────────────────────────────────────────

const getCycleData = () => {
  const profile = LocalStorage.getPartnerProfile();
  if (!profile?.cycleStartDate) return null;

  const history  = LocalStorage.getCycleHistory();
  const recalc   = recalculateCycleLengths(history);
  const stats    = calculateStatistics(recalc);
  const cs       = LocalStorage.getCycleSettings();

  return {
    cycleStartDate: profile.cycleStartDate,
    avgLen:   stats.ewma_length || stats.average_length || profile.cycleLength || 28,
    mLen:     cs.menstrualLength || 5,
    lConst:   cs.lutealConstant  || 14,
    isEstimate: stats.total_cycles_tracked === 0,
    partnerName: profile.partnerName,
  };
};

const getTransitionDates = (cycleStartDate, avgLen, mLen, lConst) => {
  const b     = computePhaseBoundaries(avgLen, mLen, lConst);
  const start = parseDateLocal(cycleStartDate);

  const transitions = [
    { phaseKey: 'Follicular',        transDay: b.menstrualEnd + 1 },
    { phaseKey: 'Ovulation',         transDay: b.follicularEnd + 1 },
    { phaseKey: 'Early Luteal',      transDay: b.ovulationEnd + 1 },
    { phaseKey: 'Late Luteal/PMS',   transDay: b.lutealEnd + 1 },
    { phaseKey: 'Menstrual',         transDay: b.total + 1 },
  ];

  const now = new Date();

  return transitions.map(t => {
    const transDate = new Date(start);
    transDate.setDate(transDate.getDate() + t.transDay - 1);

    const reminder = new Date(transDate);
    reminder.setDate(reminder.getDate() - 1);
    reminder.setHours(NOTIFICATION_HOUR, 0, 0, 0);

    return {
      phaseKey:       t.phaseKey,
      transitionDate: transDate,
      reminderDate:   reminder,
      reminderFuture: reminder > now,
    };
  });
};

// ── Day 1 logging (reuses the same path as Dashboard handleLogPeriod) ──

export const logDay1FromNotification = (dateStr) => {
  const dateToLog = dateStr || new Date().toISOString().split('T')[0];

  // De-duplicate: skip if this date is already the most recent cycle entry
  const existing = LocalStorage.getCycleHistory();
  if (existing.length > 0) {
    const sorted = recalculateCycleLengths(existing);
    const latest = sorted[sorted.length - 1];
    if (latest && latest.cycle_start_date === dateToLog) return; // already logged
  }

  LocalStorage.addCycleEntry({
    cycle_start_date: dateToLog,
    cycle_length: null,
    status: 'current',
  });

  const history = LocalStorage.getCycleHistory();
  const recalculated = recalculateCycleLengths(history);

  if (recalculated.length > 0) {
    const mostRecent = recalculated[recalculated.length - 1];
    const profile = LocalStorage.getPartnerProfile();
    if (profile) {
      const updated = { ...profile, cycleStartDate: mostRecent.cycle_start_date };
      LocalStorage.savePartnerProfile(updated);
    }
  }

  // Clear extension state for fresh cycle
  LocalStorage.clearExtensionState();

  // Reschedule notifications for new cycle
  rescheduleNotifications();
};

// ── Day 1 dismissed handler ────────────────────────────────────────

const DAY1_DISMISSED_KEY = 'cyclecoach_day1_dismissed';

const markDay1Dismissed = (cycleStartDate) => {
  try {
    const uid = JSON.parse(localStorage.getItem('user') || '{}').id || '';
    const key = uid ? `${DAY1_DISMISSED_KEY}_${uid}` : DAY1_DISMISSED_KEY;
    localStorage.setItem(key, cycleStartDate);
  } catch { /* ignore */ }
};

export const getDay1DismissedMessage = () => {
  try {
    const uid = JSON.parse(localStorage.getItem('user') || '{}').id || '';
    const key = uid ? `${DAY1_DISMISSED_KEY}_${uid}` : DAY1_DISMISSED_KEY;
    const val = localStorage.getItem(key);
    if (val) {
      localStorage.removeItem(key);
      return "Got it. This check-in won\u2019t come back until next cycle\u2019s predicted start \u2014 if her period begins on a different day than expected, be sure to log it manually in Cycle History.";
    }
  } catch { /* ignore */ }
  return null;
};

// ── Native action-type registration & listener ─────────────────────

let listenerRegistered = false;

const registerDay1Actions = async () => {
  if (!isNativePlatform() || listenerRegistered) return;
  listenerRegistered = true;

  try {
    await LocalNotifications.registerActionTypes({
      types: [{
        id: 'DAY1_CONFIRM',
        actions: [
          { id: 'yes', title: 'Yes, Log Day 1' },
          { id: 'no',  title: 'Not Yet' },
        ],
      }],
    });
  } catch (e) { console.warn('registerActionTypes failed:', e); }

  try {
    await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const nid      = event.notification.id;
      const actionId = event.actionId;

      if (nid === DAY1_CHECKIN_ID) {
        const predictedDate = event.notification.extra?.predictedDate;
        if (actionId === 'yes') {
          logDay1FromNotification(predictedDate);
        } else {
          // "no" or dismiss — mark dismissed for follow-up toast
          const data = getCycleData();
          markDay1Dismissed(data?.cycleStartDate || '');
        }
      }
    });
  } catch (e) { console.warn('addListener failed:', e); }
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

  const data = getCycleData();
  if (!data) return;

  const settings = LocalStorage.getNotificationSettings();

  await cancelAllScheduled();

  const transitions = getTransitionDates(data.cycleStartDate, data.avgLen, data.mLen, data.lConst);
  const now   = new Date();
  const batch = [];

  // ── Phase-change reminders ──
  if (settings.phaseReminders !== false) {
    transitions.forEach((t, i) => {
      if (t.reminderFuture) {
        const m = buildReminderMessage(t.phaseKey, data.isEstimate);
        batch.push({
          id: PHASE_REMINDER_IDS[i],
          title: m.title,
          body: m.body,
          schedule: { at: t.reminderDate, allowWhileIdle: true },
          sound: 'default',
          smallIcon: 'ic_launcher',
        });
      }
    });
  }

  // ── Day 1 Check-in (on predicted start of next Menstrual) ──
  if (settings.day1CheckIn !== false) {
    const menstrualTransition = transitions[transitions.length - 1]; // last = Menstrual
    const day1Date = new Date(menstrualTransition.transitionDate);
    day1Date.setHours(NOTIFICATION_HOUR, 0, 0, 0);

    if (day1Date > now) {
      const predictedDateStr = day1Date.toISOString().split('T')[0];
      const name = data.partnerName || 'her';
      let body = `Is today Day 1 for ${name}? Tap Yes to log it and keep predictions accurate.`;
      if (data.isEstimate) body += ' (Estimated \u2014 no history yet)';

      batch.push({
        id: DAY1_CHECKIN_ID,
        title: 'Period check-in',
        body,
        schedule: { at: day1Date, allowWhileIdle: true },
        sound: 'default',
        smallIcon: 'ic_launcher',
        actionTypeId: 'DAY1_CONFIRM',
        extra: { predictedDate: predictedDateStr },
      });
    }
  }

  // ── Cycle extension alert (avg + 2) ──
  if (settings.phaseReminders !== false) {
    const start     = parseDateLocal(data.cycleStartDate);
    const extDate   = new Date(start);
    extDate.setDate(extDate.getDate() + data.avgLen + 1); // Day avg+2
    extDate.setHours(NOTIFICATION_HOUR, 0, 0, 0);

    if (extDate > now) {
      const name = data.partnerName || 'her';
      batch.push({
        id: EXTENSION_ALERT_ID,
        title: 'Cycle extended \u2014 check in',
        body: `Day ${data.avgLen + 2} and counting for ${name}. Periods can vary \u2014 confirm if the cycle has extended.`,
        schedule: { at: extDate, allowWhileIdle: true },
        sound: 'default',
        smallIcon: 'ic_launcher',
      });
    }
  }

  if (batch.length) {
    try {
      await LocalNotifications.schedule({ notifications: batch });
    } catch (e) { console.error('Schedule notifications failed:', e); }
  }
};

export const rescheduleNotifications = async () => {
  if (isNativePlatform()) await scheduleNativeNotifications();
};

// ── Web-only checks (run on visit / focus) ─────────────────────────

const showWebNotification = (title, opts = {}) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { icon: '/favicon.ico', badge: '/favicon.ico', vibrate: [200, 100, 200], ...opts });
};

export const runNotificationChecks = () => {
  if (isNativePlatform()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const settings = LocalStorage.getNotificationSettings();
  const data     = getCycleData();
  if (!data) return;

  const uid      = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').id || ''; } catch { return ''; } })();
  const notifKey = uid ? `cyclecoach_last_phase_notification_${uid}` : 'cyclecoach_last_phase_notification';
  const today    = new Date().toDateString();

  // ── Phase reminder (once per day) ──
  if (settings.phaseReminders !== false && localStorage.getItem(notifKey) !== today) {
    const cycleDay = calculateCycleDay(data.cycleStartDate);
    const b        = computePhaseBoundaries(data.avgLen, data.mLen, data.lConst);

    const edges = [
      { day: b.menstrualEnd,   nextKey: 'Follicular' },
      { day: b.follicularEnd,  nextKey: 'Ovulation' },
      { day: b.ovulationEnd,   nextKey: 'Early Luteal' },
      { day: b.lutealEnd,      nextKey: 'Late Luteal/PMS' },
      { day: b.total,          nextKey: 'Menstrual' },
    ];

    for (const e of edges) {
      if (cycleDay === e.day) {
        const m = buildReminderMessage(e.nextKey, data.isEstimate);
        showWebNotification(m.title, { body: m.body });
        localStorage.setItem(notifKey, today);
        break;
      }
    }
  }

  // ── Cycle extension alert (web — fires once per extended cycle) ──
  if (settings.phaseReminders !== false) {
    const cycleDay = calculateCycleDay(data.cycleStartDate);
    const status   = getCycleExtensionStatus(cycleDay, data.avgLen);

    if (status !== 'normal') {
      const extState = LocalStorage.getExtensionState();
      if (extState?.alertShownForCycleStart !== data.cycleStartDate) {
        LocalStorage.saveExtensionState({ ...(extState || {}), alertShownForCycleStart: data.cycleStartDate, confirmed: null });
        showWebNotification('Cycle extended \u2014 check in', {
          body: `Day ${cycleDay} and counting. Periods can vary \u2014 confirm if the cycle has extended.`,
        });
      }
    }
  }

  // ── Day 1 Check-in (web — fires once on predicted Day 1) ──
  if (settings.day1CheckIn !== false) {
    const cycleDay = calculateCycleDay(data.cycleStartDate);
    const b        = computePhaseBoundaries(data.avgLen, data.mLen, data.lConst);

    if (cycleDay === b.total + 1) {
      const day1Key = uid ? `cyclecoach_day1_web_shown_${uid}` : 'cyclecoach_day1_web_shown';
      if (localStorage.getItem(day1Key) !== data.cycleStartDate) {
        localStorage.setItem(day1Key, data.cycleStartDate);
        const name = data.partnerName || 'her';
        let body = `Is today Day 1 for ${name}? Open Cycle History to log it and keep predictions accurate.`;
        if (data.isEstimate) body += ' (Estimated \u2014 no history yet)';
        showWebNotification('Period check-in', { body });
      }
    }
  }
};

// ── Public API ──────────────────────────────────────────────────────

export const initializeNotifications = async () => {
  if (!isNotificationsSupported()) return false;
  const perm = await checkNotificationPermission();
  if (perm !== 'granted') return false;
  if (isNativePlatform()) {
    await registerDay1Actions();
    await scheduleNativeNotifications();
  }
  return true;
};

export const enableNotifications = async () => {
  if (!isNotificationsSupported()) return { success: false, message: 'Notifications not supported on this device' };
  const perm = await requestNotificationPermission();
  if (perm === 'granted') {
    if (isNativePlatform()) {
      await registerDay1Actions();
      await scheduleNativeNotifications();
    }
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
          body: "Notifications are working. You\u2019ll get reminders before phase changes.",
          schedule: { at: new Date(Date.now() + 1000) },
          sound: 'default',
          smallIcon: 'ic_launcher',
        }],
      });
      return true;
    } catch { return false; }
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  showWebNotification('Test notification', { body: "Notifications are working. You\u2019ll get reminders before phase changes." });
  return true;
};

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
  logDay1FromNotification,
  getDay1DismissedMessage,
};

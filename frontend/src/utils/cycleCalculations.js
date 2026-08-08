/**
 * Client-side cycle calculations
 * No server required - all calculations happen in browser
 * Supports EWMA-based dynamic averages, extended cycle detection, and capped UI
 */

// Parse a date string into a local Date object (no timezone issues)
export const parseDateLocal = (dateStr) => {
  let year, month, day;
  if (dateStr.includes('-')) {
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      [year, month, day] = dateStr.split('-').map(Number);
    } else {
      [month, day, year] = dateStr.split('-').map(Number);
    }
  } else if (dateStr.includes('/')) {
    [month, day, year] = dateStr.split('/').map(Number);
  } else {
    const d = new Date(dateStr);
    year = d.getFullYear();
    month = d.getMonth() + 1;
    day = d.getDate();
  }
  return new Date(year, month - 1, day);
};

/**
 * Calculate the actual (continuous) cycle day — never wraps around.
 * Returns the raw number of days since the current cycle started + 1.
 */
export const calculateCycleDay = (startDate) => {
  const start = parseDateLocal(startDate);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const daysSinceStart = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  if (daysSinceStart < 0) return 1;
  return daysSinceStart + 1;
};

/**
 * EWMA (Exponential Weighted Moving Average) for cycle length.
 * new_average = (alpha * latest) + ((1 - alpha) * previous_average)
 */
const EWMA_ALPHA = 0.3;

export const calculateEWMA = (completedCycles) => {
  if (!completedCycles || completedCycles.length === 0) return 28;
  const lengths = completedCycles
    .filter(c => c.cycle_length && c.cycle_length > 0)
    .map(c => c.cycle_length);
  if (lengths.length === 0) return 28;
  let avg = lengths[0];
  for (let i = 1; i < lengths.length; i++) {
    avg = (EWMA_ALPHA * lengths[i]) + ((1 - EWMA_ALPHA) * avg);
  }
  return Math.round(avg);
};

/**
 * Detect outliers: only after 6+ completed cycles.
 * An outlier deviates > 2 standard deviations from the EWMA trend.
 */
export const detectOutlier = (cycleLength, completedCycles) => {
  if (!completedCycles || completedCycles.length < 6) return false;
  const lengths = completedCycles
    .filter(c => c.cycle_length && c.cycle_length > 0)
    .map(c => c.cycle_length);
  if (lengths.length < 6) return false;
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  return Math.abs(cycleLength - mean) > 2 * stdDev;
};

/**
 * Get the UI display day, capped at average + 7.
 * Returns { displayDay, isCapped }
 */
export const getDisplayCycleDay = (actualDay, averageLength) => {
  const cap = averageLength + 7;
  if (actualDay > cap) {
    return { displayDay: cap, isCapped: true };
  }
  return { displayDay: actualDay, isCapped: false };
};

/**
 * Determine the cycle extension status.
 * Returns: 'normal' | 'extended' | 'capped'
 */
export const getCycleExtensionStatus = (actualDay, averageLength) => {
  if (actualDay > averageLength + 7) return 'capped';
  if (actualDay > averageLength + 2) return 'extended';
  return 'normal';
};

/**
 * Get playful messages for capped cycles (average + 7)
 */
export const getCappedCycleMessages = () => [
  "Tracking may have paused — her body's on its own schedule.",
  "Could be a plot twist? If she hasn't started, she might just be running late.",
  "Bodies don't read calendars. If her period hasn't come yet, it's probably just fashionably late.",
  "Still waiting? Cycles can be unpredictable. No need to panic — just keep being awesome.",
  "Her cycle went off-script. It happens! Check in with her when the time feels right.",
];

/**
 * Compute dynamic phase boundaries based on the clinical model:
 * - Luteal phase is ~fixed (default 14 days, adjustable 11-16)
 * - PMS is the last ~5-7 days of luteal constant
 * - Follicular phase absorbs all cycle length variation
 * - Ovulation is a 3-day window at the end of follicular
 *
 * @param {number} totalCycleLength - user's average cycle length
 * @param {number} menstrualLength - average period length (default 5)
 * @param {number} lutealConstant - post-ovulation days (default 14, range 11-16)
 * @returns {{ menstrualEnd, follicularEnd, ovulationEnd, lutealEnd, pmsStart, ovulationDay }}
 */
export const computePhaseBoundaries = (totalCycleLength = 28, menstrualLength = 5, lutealConstant = 14) => {
  // Clamp inputs to reasonable ranges
  const total = Math.max(21, Math.min(45, totalCycleLength));
  const mLen = Math.max(3, Math.min(7, menstrualLength));
  const lConst = Math.max(11, Math.min(16, lutealConstant));

  // Core formula: follicular absorbs all variation
  const follicularLength = Math.max(3, total - mLen - lConst);
  const ovulationDay = mLen + follicularLength;

  // Ovulation window: 3 days centered on ovulationDay (taken from end of follicular)
  const ovulationWindowStart = Math.max(mLen + 1, ovulationDay - 1);
  const ovulationWindowEnd = ovulationDay + 1;

  // Post-ovulation: split lutealConstant into Luteal + PMS
  // PMS = last 5 days (or 6 if lutealConstant >= 15), Luteal = remainder
  const pmsLength = lConst >= 15 ? 6 : 5;
  const lutealLength = lConst - pmsLength;

  const menstrualEnd = mLen;
  const follicularEnd = ovulationWindowStart - 1;
  const ovulationEnd = ovulationWindowEnd;
  const lutealEnd = ovulationEnd + lutealLength;
  // PMS runs from lutealEnd+1 through total

  return {
    menstrualEnd,
    follicularEnd,
    ovulationEnd,
    lutealEnd,
    total,
    ovulationDay,
    // For display in Phase Reference cards
    ranges: {
      menstrual: `1\u2013${menstrualEnd}`,
      follicular: `${menstrualEnd + 1}\u2013${follicularEnd}`,
      ovulation: `${follicularEnd + 1}\u2013${ovulationEnd}`,
      luteal: `${ovulationEnd + 1}\u2013${lutealEnd}`,
      pms: `${lutealEnd + 1}\u2013${total}`,
    },
  };
};

export const getPhaseInfo = (cycleDay, averageLength = 28, menstrualLength = 5, lutealConstant = 14) => {
  const { PHASE_CONTENT } = require('./phaseContent');
  const b = computePhaseBoundaries(averageLength, menstrualLength, lutealConstant);

  let phaseName, phaseNumber, phaseDay;

  if (cycleDay > b.total) {
    phaseName = "Late Luteal/PMS";
    phaseNumber = 5;
    phaseDay = cycleDay - b.lutealEnd;
  } else if (cycleDay >= 1 && cycleDay <= b.menstrualEnd) {
    phaseName = "Menstrual";
    phaseNumber = 1;
    phaseDay = cycleDay;
  } else if (cycleDay > b.menstrualEnd && cycleDay <= b.follicularEnd) {
    phaseName = "Follicular";
    phaseNumber = 2;
    phaseDay = cycleDay - b.menstrualEnd;
  } else if (cycleDay > b.follicularEnd && cycleDay <= b.ovulationEnd) {
    phaseName = "Ovulation";
    phaseNumber = 3;
    phaseDay = cycleDay - b.follicularEnd;
  } else if (cycleDay > b.ovulationEnd && cycleDay <= b.lutealEnd) {
    phaseName = "Early Luteal";
    phaseNumber = 4;
    phaseDay = cycleDay - b.ovulationEnd;
  } else {
    phaseName = "Late Luteal/PMS";
    phaseNumber = 5;
    phaseDay = cycleDay - b.lutealEnd;
  }

  const content = PHASE_CONTENT[phaseName] || PHASE_CONTENT["Late Luteal/PMS"];
  return {
    phase: phaseName,
    phase_number: phaseNumber,
    phase_day: phaseDay,
    emoji: content.emoji,
    punchline: content.punchline,
    briefPlayByPlay: content.briefPlayByPlay,
    briefFeelings: content.briefFeelings,
    prep: content.prep,
    action: content.action,
    fullContent: content,
    boundaries: b,
  };
};

export const recalculateCycleLengths = (history) => {
  if (!history || history.length === 0) return [];
  
  // Parse dates and sort
  const parseDate = (dateStr) => {
    const formats = [
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
      /(\d{2})-(\d{2})-(\d{4})/ // MM-DD-YYYY
    ];
    
    for (const fmt of formats) {
      const match = dateStr.match(fmt);
      if (match) {
        if (fmt === formats[0]) { // YYYY-MM-DD
          return new Date(match[1], match[2] - 1, match[3]);
        } else { // MM/DD/YYYY or MM-DD-YYYY
          return new Date(match[3], match[1] - 1, match[2]);
        }
      }
    }
    return new Date(dateStr);
  };
  
  // Sort by date
  const sorted = [...history].sort((a, b) => {
    return parseDate(a.cycle_start_date) - parseDate(b.cycle_start_date);
  });
  
  // Calculate lengths
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = parseDate(sorted[i].cycle_start_date);
    const next = parseDate(sorted[i + 1].cycle_start_date);
    const days = Math.floor((next - current) / (1000 * 60 * 60 * 24));
    sorted[i].cycle_length = days;
    sorted[i].status = 'completed';
  }
  
  // Mark last as current
  if (sorted.length > 0) {
    sorted[sorted.length - 1].cycle_length = null;
    sorted[sorted.length - 1].status = 'current';
  }
  
  return sorted;
};

export const calculateStatistics = (history) => {
  const completed = history.filter(h => h.cycle_length && h.cycle_length > 0);
  
  if (completed.length === 0) {
    return {
      average_length: 28,
      ewma_length: 28,
      min_length: 28,
      max_length: 28,
      variability: 0,
      is_irregular: false,
      total_cycles_tracked: 0
    };
  }
  
  const lengths = completed.map(h => h.cycle_length);
  const simpleAvg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  const ewmaAvg = calculateEWMA(completed);
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  
  return {
    average_length: ewmaAvg,
    simple_average: simpleAvg,
    ewma_length: ewmaAvg,
    min_length: min,
    max_length: max,
    variability: max - min,
    is_irregular: (max - min) > 7,
    total_cycles_tracked: completed.length
  };
};

export const predictNextPeriod = (mostRecentDate, averageLength) => {
  const lastStart = new Date(mostRecentDate);
  const nextStart = new Date(lastStart);
  nextStart.setDate(nextStart.getDate() + averageLength);
  
  const today = new Date();
  const daysUntil = Math.floor((nextStart - today) / (1000 * 60 * 60 * 24));
  
  return {
    next_period_date: nextStart.toISOString().split('T')[0],
    days_until_next: daysUntil
  };
};

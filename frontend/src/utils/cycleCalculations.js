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

export const getPhaseInfo = (cycleDay, averageLength = 28) => {
  // Scale phase boundaries relative to the user's average
  const scale = averageLength / 28;
  const menstrualEnd = 5;
  const follicularEnd = Math.round(13 * scale);
  const ovulationEnd = Math.round(16 * scale);
  const earlyLutealEnd = Math.round(23 * scale);

  // If past the average, stay in Late Luteal/PMS (extended)
  if (cycleDay > averageLength) {
    return {
      phase: "Late Luteal/PMS",
      phase_number: 5,
      phase_day: cycleDay - earlyLutealEnd,
      description: "Cycle extended — she might be running late this month.",
      emoji: "⚠️",
      tips: [
        "**Stay patient.** Cycles vary — this is normal.",
        "Keep up the **comfort items** — she may still need them.",
        "**Don't mention it** unless she brings it up first.",
        "**Food delivery apps** remain your best friend."
      ]
    };
  }

  if (cycleDay >= 1 && cycleDay <= menstrualEnd) {
    return {
      phase: "Menstrual",
      phase_number: 1,
      phase_day: cycleDay,
      description: "Red alert - literally. She's on her period.",
      emoji: "🩸",
      tips: [
        "**Do the dishes.** Like, NOW. Don't wait to be asked.",
        "Get her **favorite snacks**. Ben & Jerry's never hurt nobody.",
        "**Netflix marathon** = your best move. Let her pick.",
        "**Heating pad + backrub** = you're a goddamn hero."
      ]
    };
  } else if (cycleDay > menstrualEnd && cycleDay <= follicularEnd) {
    return {
      phase: "Follicular",
      phase_number: 2,
      phase_day: cycleDay - menstrualEnd,
      description: "The storm has passed. She's back, baby!",
      emoji: "🌸",
      tips: [
        "**Book that fancy restaurant** NOW while she's saying yes to everything",
        "She'll actually want to **leave the house** - capitalize on this window",
        "**Compliments land HARD** right now - tell her she looks amazing",
        "Good time to bring up **that thing you've been avoiding**"
      ]
    };
  } else if (cycleDay > follicularEnd && cycleDay <= ovulationEnd) {
    return {
      phase: "Ovulation",
      phase_number: 3,
      phase_day: cycleDay - follicularEnd,
      description: "🔥 PRIME TIME 🔥 This is it chief",
      emoji: "🔥",
      tips: [
        "**BRO. This is THE window.** Clear your schedule.",
        "Tell her she looks **hot**. Then tell her again.",
        "**Plan something romantic tonight** (you know exactly why)",
        "Put the **phone down**. Give her your **FULL attention**."
      ]
    };
  } else if (cycleDay > ovulationEnd && cycleDay <= earlyLutealEnd) {
    return {
      phase: "Early Luteal",
      phase_number: 4,
      phase_day: cycleDay - ovulationEnd,
      description: "Chill vibes. Enjoy it while it lasts.",
      emoji: "🏠",
      tips: [
        "She's in **nesting mode** - help with home projects",
        "**Notice when she cleans/cooks** - say thank you",
        "Low-key **date nights > wild adventures** right now",
        "**Quality time on the couch** > going out"
      ]
    };
  } else {
    return {
      phase: "Late Luteal/PMS",
      phase_number: 5,
      phase_day: cycleDay - earlyLutealEnd,
      description: "⚠️ DEFCON 1 ⚠️ Tread carefully, soldier",
      emoji: "⚠️",
      tips: [
        "Whatever she says, **she's right**. I don't care if she's wrong - **SHE'S RIGHT.**",
        "Buy **tampons BEFORE she asks**.",
        "**Cancel plans** if she's not feeling it. Don't be a hero.",
        "**Food delivery apps** are your best friend this week."
      ]
    };
  }
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

/**
 * Client-side cycle calculations
 * No server required - all calculations happen in browser
 */

export const calculateCycleDay = (startDate, cycleLength = 28) => {
  const start = new Date(startDate);
  const today = new Date();
  const daysSinceStart = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  return (daysSinceStart % cycleLength) + 1;
};

export const getPhaseInfo = (cycleDay) => {
  if (cycleDay >= 1 && cycleDay <= 5) {
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
  } else if (cycleDay >= 6 && cycleDay <= 13) {
    return {
      phase: "Follicular",
      phase_number: 2,
      phase_day: cycleDay - 5,
      description: "The storm has passed. She's back, baby!",
      emoji: "🌸",
      tips: [
        "**Book that fancy restaurant** NOW while she's saying yes to everything",
        "She'll actually want to **leave the house** - capitalize on this window",
        "**Compliments land HARD** right now - tell her she looks amazing",
        "Good time to bring up **that thing you've been avoiding**"
      ]
    };
  } else if (cycleDay >= 14 && cycleDay <= 16) {
    return {
      phase: "Ovulation",
      phase_number: 3,
      phase_day: cycleDay - 13,
      description: "🔥 PRIME TIME 🔥 This is it chief",
      emoji: "🔥",
      tips: [
        "**BRO. This is THE window.** Clear your schedule.",
        "Tell her she looks **hot**. Then tell her again.",
        "**Plan something romantic tonight** (you know exactly why)",
        "Put the **phone down**. Give her your **FULL attention**."
      ]
    };
  } else if (cycleDay >= 17 && cycleDay <= 23) {
    return {
      phase: "Early Luteal",
      phase_number: 4,
      phase_day: cycleDay - 16,
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
      phase_day: cycleDay - 23,
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
      min_length: 28,
      max_length: 28,
      variability: 0,
      is_irregular: false,
      total_cycles_tracked: 0
    };
  }
  
  const lengths = completed.map(h => h.cycle_length);
  const average = Math.floor(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  
  return {
    average_length: average,
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

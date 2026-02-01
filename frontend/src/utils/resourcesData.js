/**
 * Custom Resources Database for Cycle Coach
 * Phase-based articles with summaries
 * Organized by cycle phase with emoji labels
 */

// Phase constants with emojis
export const PHASE_LABELS = {
  'Full-Cycle': { emoji: '🔄', label: 'Full-Cycle Education', days: 'All Days' },
  'Menstrual': { emoji: '🩸', label: 'Menstrual', days: 'Days 1–5' },
  'Follicular': { emoji: '🌸', label: 'Follicular', days: 'Days 6–13' },
  'Ovulation': { emoji: '🔥', label: 'Ovulation', days: 'Days 14–16' },
  'Early Luteal': { emoji: '🏠', label: 'Early Luteal', days: 'Days 17–23' },
  'Late Luteal/PMS': { emoji: '⚠️', label: 'PMS / Late Luteal', days: 'Days 24–28' }
};

// Complete Resources Database
export const RESOURCES = [
  // 🔄 FULL-CYCLE EDUCATION
  {
    id: 'full-cycle-1',
    title: 'Cleveland Clinic — Menstrual Cycle Overview',
    url: 'https://my.clevelandclinic.org/health/articles/10132-menstrual-cycle',
    phase: 'Full-Cycle',
    summary: 'A medical-grade explanation of all four phases, giving partners a clear understanding of the full hormonal rhythm.',
    source: 'Cleveland Clinic'
  },
  {
    id: 'full-cycle-2',
    title: 'How to Explain Each Week of Your Cycle to Men',
    url: 'https://www.myhormonology.com/how-to-explain-each-week-of-your-cycle-to-the-men-in-your-life/',
    phase: 'Full-Cycle',
    summary: 'Translates hormonal shifts into simple, relatable language specifically for men.',
    source: 'Hormonology'
  },
  {
    id: 'full-cycle-3',
    title: 'The Menstrual Cycle as a Vital Sign',
    url: 'https://www.thelancet.com/journals/lanogw/article/PIIS3050-5038(25)00001-9/fulltext',
    phase: 'Full-Cycle',
    summary: 'A research-backed look at why the menstrual cycle is a key indicator of overall health.',
    source: 'The Lancet'
  },
  {
    id: 'full-cycle-4',
    title: 'Explaining Periods to Men',
    url: 'https://www.pandiahealth.com/blog/explaining-periods-men/',
    phase: 'Full-Cycle',
    summary: 'Addresses common misconceptions and helps men understand the basics without awkwardness.',
    source: 'Pandia Health'
  },
  {
    id: 'full-cycle-5',
    title: 'Physiology of the Menstrual Cycle',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK500020/',
    phase: 'Full-Cycle',
    summary: 'A definitive scientific breakdown of hormonal changes across the entire cycle.',
    source: 'NIH'
  },

  // 🩸 MENSTRUAL PHASE (Days 1–5)
  {
    id: 'menstrual-1',
    title: 'What Guys Need to Know About Periods',
    url: 'https://www.goodrx.com/health-topic/mens-health/what-guys-need-to-know-about-periods',
    phase: 'Menstrual',
    summary: 'Practical guidance on symptoms, mood changes, and how to support during bleeding.',
    source: 'GoodRx'
  },
  {
    id: 'menstrual-2',
    title: 'The Manly Guide to Menstruation',
    url: 'https://helloclue.com/articles/sex/manly-guide-to-menstruation',
    phase: 'Menstrual',
    summary: 'A straightforward guide for men explaining cramps, bloating, and emotional shifts.',
    source: 'Clue'
  },
  {
    id: 'menstrual-3',
    title: '4 Phases of the Menstrual Cycle',
    url: 'https://www.morelandobgyn.com/blog/4-phases-of-the-menstrual-cycle',
    phase: 'Menstrual',
    summary: "Explains what's normal during menstruation and how the body resets for the next cycle.",
    source: 'Moreland OB-GYN'
  },

  // 🌸 FOLLICULAR PHASE (Days 6–13)
  {
    id: 'follicular-1',
    title: 'Follicular Phase',
    url: 'https://www.naturalcycles.com/cyclematters/follicular-phase',
    phase: 'Follicular',
    summary: 'Covers rising estrogen, increased energy, and mental clarity.',
    source: 'Natural Cycles'
  },
  {
    id: 'follicular-2',
    title: 'Follicular Phase Overview',
    url: 'https://www.healthline.com/health/womens-health/follicular-phase',
    phase: 'Follicular',
    summary: 'Breaks down symptoms, hormone changes, and why optimism tends to rise.',
    source: 'Healthline'
  },
  {
    id: 'follicular-3',
    title: 'Follicular Phase 101',
    url: 'https://progyny.com/education/fertility-101/follicular-phase/',
    phase: 'Follicular',
    summary: 'Explains follicle development and how estrogen prepares the body for ovulation.',
    source: 'Progyny'
  },
  {
    id: 'follicular-4',
    title: 'Phases of the Menstrual Cycle',
    url: 'https://healthy.kaiserpermanente.org/health-wellness/healtharticle.phases-of-the-menstrual-cycle',
    phase: 'Follicular',
    summary: 'A simple medical overview of the first half of the cycle.',
    source: 'Kaiser Permanente'
  },
  {
    id: 'follicular-5',
    title: 'Phases of the Menstrual Cycle',
    url: 'https://www.raleighob.com/phases-of-the-menstrual-cycle/',
    phase: 'Follicular',
    summary: 'Describes endometrial rebuilding and the emotional lift partners may notice.',
    source: 'Raleigh OB-GYN'
  },
  {
    id: 'follicular-6',
    title: 'Cycle Syncing Through Your Menstrual Phases',
    url: 'https://www.trinityhealthmichigan.org/blog-articles/cycle-syncing-through-your-menstrual-phases',
    phase: 'Follicular',
    summary: 'Offers diet and activity suggestions that partners can support.',
    source: 'Trinity Health'
  },

  // 🔥 OVULATION PHASE (Days 14–16)
  {
    id: 'ovulation-1',
    title: 'Can Men Smell Ovulation?',
    url: 'https://www.science.org/content/article/scienceadviser-no-men-probably-can-t-smell-when-women-are-ovulating',
    phase: 'Ovulation',
    summary: 'Debunks myths while explaining subtle behavioral cues around ovulation.',
    source: 'Science.org'
  },
  {
    id: 'ovulation-2',
    title: 'Attraction Changes Near Ovulation',
    url: 'https://www.sciencedirect.com/science/article/abs/pii/S0301051113002020',
    phase: 'Ovulation',
    summary: 'Research on how attraction and partner perception shift during peak fertility.',
    source: 'ScienceDirect'
  },
  {
    id: 'ovulation-3',
    title: 'Evolutionary Shifts in Attraction',
    url: 'https://www.medicalnewstoday.com/articles/272697',
    phase: 'Ovulation',
    summary: 'Explores the biological drivers behind ovulation-related preference changes.',
    source: 'Medical News Today'
  },
  {
    id: 'ovulation-4',
    title: 'Ovulation & Sexual Desire',
    url: 'https://www.psychologytoday.com/us/blog/sex-murder-and-the-meaning-of-life/201906/does-ovulation-change-womens-sexual-desire-after-all',
    phase: 'Ovulation',
    summary: 'Discusses libido peaks and how they influence relationship dynamics.',
    source: 'Psychology Today'
  },
  {
    id: 'ovulation-5',
    title: 'Partner Choice of Women',
    url: 'https://www.mpib-berlin.mpg.de/press-releases/partner-choice-of-women',
    phase: 'Ovulation',
    summary: 'A modern, data-driven look at ovulatory behavior and attraction.',
    source: 'Max Planck Institute'
  },

  // 🏠 EARLY LUTEAL (Days 17–23)
  {
    id: 'early-luteal-1',
    title: 'What Men Need to Know About Menstruation',
    url: 'https://mycounselor.online/what-men-need-to-know-about-menstruation/',
    phase: 'Early Luteal',
    summary: 'Helps men understand the "nesting" phase and how to support emotionally.',
    source: 'MyCounselor.Online'
  },
  {
    id: 'early-luteal-2',
    title: "Men's Perceptions of PMS",
    url: 'https://journals.sagepub.com/doi/10.1177/1557988313497050',
    phase: 'Early Luteal',
    summary: 'Research on how men interpret PMS and how understanding improves relationships.',
    source: 'Journal of Men\'s Health'
  },

  // ⚠️ PMS / LATE LUTEAL (Days 24–28)
  {
    id: 'pms-1',
    title: 'The Menstrual Cycle and Relationships',
    url: 'https://scholarsarchive.byu.edu/cgi/viewcontent.cgi?article=1140&context=familyperspectives',
    phase: 'Late Luteal/PMS',
    summary: 'Explains why men may take mood shifts personally and how to respond better.',
    source: 'BYU Scholars'
  },
  {
    id: 'pms-2',
    title: 'Hormonal Changes & Relationship Interdependence',
    url: 'https://www.sciencedirect.com/science/article/abs/pii/S0301051119302509',
    phase: 'Late Luteal/PMS',
    summary: "Shows how men's hormones may subtly respond to their partner's luteal phase.",
    source: 'ScienceDirect'
  },
  {
    id: 'pms-3',
    title: 'Physiology of the Luteal Decline',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK500020/',
    phase: 'Late Luteal/PMS',
    summary: 'Medical explanation of progesterone drop and physical symptoms like bloating.',
    source: 'NIH'
  }
];

// Custom Resources (same as RESOURCES for backward compatibility)
export const CUSTOM_RESOURCES = RESOURCES;

/**
 * Get phase emoji and label
 */
export const getPhaseEmoji = (phase) => {
  return PHASE_LABELS[phase]?.emoji || '📚';
};

export const getPhaseLabel = (phase) => {
  return PHASE_LABELS[phase]?.label || phase;
};

export const getPhaseDays = (phase) => {
  return PHASE_LABELS[phase]?.days || '';
};

/**
 * Get phase color class for styling
 */
export const getPhaseColor = (phase) => {
  const colors = {
    'Full-Cycle': 'text-white bg-indigo-500/50 border-indigo-500/50',
    'Menstrual': 'text-white bg-red-500/50 border-red-500/50',
    'Follicular': 'text-white bg-pink-500/50 border-pink-500/50',
    'Ovulation': 'text-white bg-orange-500/50 border-orange-500/50',
    'Early Luteal': 'text-white bg-blue-500/50 border-blue-500/50',
    'Late Luteal/PMS': 'text-white bg-yellow-500/50 border-yellow-500/50'
  };
  return colors[phase] || 'text-white bg-slate-500/50 border-slate-500/50';
};

/**
 * Get resources for a specific phase
 */
export const getResourcesByPhase = (phase) => {
  return RESOURCES.filter(r => r.phase === phase);
};

/**
 * Get resources prioritized by current phase
 * Shows "Recommended for Her Current Phase" at top
 */
export const getPhasePrioritizedResources = (currentPhase) => {
  const phases = ['Menstrual', 'Follicular', 'Ovulation', 'Early Luteal', 'Late Luteal/PMS'];
  const currentIndex = phases.indexOf(currentPhase);
  const upcomingPhase = phases[(currentIndex + 1) % phases.length];
  
  // Get current phase resources (highest priority)
  const currentPhaseResources = RESOURCES
    .filter(r => r.phase === currentPhase)
    .map(r => ({ ...r, priority: 1, is_phase_match: true, is_recommended: true }));
  
  // Get upcoming phase resources
  const upcomingPhaseResources = RESOURCES
    .filter(r => r.phase === upcomingPhase)
    .map(r => ({ ...r, priority: 2, is_upcoming: true, upcoming_phase: upcomingPhase }));
  
  // Get full-cycle education (always useful)
  const fullCycleResources = RESOURCES
    .filter(r => r.phase === 'Full-Cycle')
    .map(r => ({ ...r, priority: 3 }));
  
  // Get other phases
  const otherResources = RESOURCES
    .filter(r => r.phase !== currentPhase && r.phase !== upcomingPhase && r.phase !== 'Full-Cycle')
    .map(r => ({ ...r, priority: 4 }));
  
  return [
    ...currentPhaseResources,
    ...upcomingPhaseResources,
    ...fullCycleResources,
    ...otherResources
  ];
};

/**
 * Get resources grouped by phase for display
 */
export const getResourcesGroupedByPhase = () => {
  const grouped = {};
  const phaseOrder = ['Full-Cycle', 'Menstrual', 'Follicular', 'Ovulation', 'Early Luteal', 'Late Luteal/PMS'];
  
  phaseOrder.forEach(phase => {
    grouped[phase] = RESOURCES.filter(r => r.phase === phase);
  });
  
  return grouped;
};

/**
 * Get relevant resources for display
 */
export const getRelevantResources = (currentPhase, upcomingPhase) => {
  const currentResources = RESOURCES.filter(r => r.phase === currentPhase);
  const upcomingResources = RESOURCES.filter(r => r.phase === upcomingPhase)
    .map(r => ({ ...r, is_upcoming: true, upcoming_phase: upcomingPhase }));
  const fullCycleResources = RESOURCES.filter(r => r.phase === 'Full-Cycle');
  
  return {
    current: currentResources.map(r => ({ ...r, is_phase_match: true, is_recommended: true })),
    upcoming: upcomingResources,
    fullCycle: fullCycleResources,
    other: RESOURCES.filter(r => 
      r.phase !== currentPhase && 
      r.phase !== upcomingPhase && 
      r.phase !== 'Full-Cycle'
    )
  };
};

/**
 * Get the next phase in the cycle
 */
export const getNextPhase = (currentPhase) => {
  const phases = ['Menstrual', 'Follicular', 'Ovulation', 'Early Luteal', 'Late Luteal/PMS'];
  const currentIndex = phases.indexOf(currentPhase);
  if (currentIndex === -1) return 'Menstrual';
  return phases[(currentIndex + 1) % phases.length];
};

/**
 * Archive management (localStorage)
 */
export const archiveResource = (resourceId) => {
  const archived = JSON.parse(localStorage.getItem('cyclecoach_archived_resources') || '[]');
  if (!archived.includes(resourceId)) {
    archived.push(resourceId);
    localStorage.setItem('cyclecoach_archived_resources', JSON.stringify(archived));
  }
};

export const getArchivedResources = () => {
  return JSON.parse(localStorage.getItem('cyclecoach_archived_resources') || '[]');
};

export const getUnarchivedResources = (currentPhase) => {
  const archived = getArchivedResources();
  const allResources = getPhasePrioritizedResources(currentPhase);
  return allResources.filter(r => !archived.includes(r.id));
};

export const resetArchivedResources = () => {
  localStorage.removeItem('cyclecoach_archived_resources');
};

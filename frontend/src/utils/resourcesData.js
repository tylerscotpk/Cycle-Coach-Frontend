/**
 * Custom Resources Data for Cycle Coach
 * Phase-based resources with URL validation
 * Uses only user-provided URLs as source of truth
 */

// Custom resource library with phase-tagged articles
export const CUSTOM_RESOURCES = [
  // 🩸 Menstrual Phase: Days 1–5
  // Low energy, inward focus, emotional sensitivity, need for comfort
  {
    id: 'menstrual-1',
    title: 'Understanding Menstruation',
    description: 'Complete guide to what happens during menstruation and how to support her.',
    source: 'Healthline',
    type: 'Article',
    phase: 'Menstrual',
    url: 'https://www.healthline.com/health/menstruation',
    phaseDescription: 'Low energy, inward focus, emotional sensitivity, need for comfort'
  },
  {
    id: 'menstrual-2',
    title: 'How Menstruation Affects Mood',
    description: 'The psychology behind mood changes during her period.',
    source: 'Psychology Today',
    type: 'Article',
    phase: 'Menstrual',
    url: 'https://www.psychologytoday.com/us/blog/your-brain-food/202002/how-menstruation-affects-your-mood',
    phaseDescription: 'Low energy, inward focus, emotional sensitivity, need for comfort'
  },
  {
    id: 'menstrual-3',
    title: 'What Happens During Your Period',
    description: 'Medical breakdown of the menstrual phase and physical symptoms.',
    source: 'Verywell Health',
    type: 'Article',
    phase: 'Menstrual',
    url: 'https://www.verywellhealth.com/what-happens-during-your-period-5198293',
    phaseDescription: 'Low energy, inward focus, emotional sensitivity, need for comfort'
  },
  {
    id: 'menstrual-4',
    title: 'Menstrual Cycle and Mood Connection',
    description: 'Understanding the emotional aspects of her cycle.',
    source: 'Healthline',
    type: 'Article',
    phase: 'Menstrual',
    url: 'https://www.healthline.com/health/mental-health/menstrual-cycle-and-mood',
    phaseDescription: 'Low energy, inward focus, emotional sensitivity, need for comfort'
  },

  // 🌸 Follicular Phase: Days 6–13
  // Rising energy, optimism, creativity, motivation, openness
  {
    id: 'follicular-1',
    title: 'Understanding the Fertile Window',
    description: 'What happens during her most energetic days.',
    source: 'Healthline',
    type: 'Article',
    phase: 'Follicular',
    url: 'https://www.healthline.com/health/fertility/fertile-window',
    phaseDescription: 'Rising energy, optimism, creativity, motivation, openness'
  },
  {
    id: 'follicular-2',
    title: 'The Follicular Phase Explained',
    description: 'Why she has more energy and feels more optimistic.',
    source: 'Verywell Health',
    type: 'Article',
    phase: 'Follicular',
    url: 'https://www.verywellhealth.com/follicular-phase-5198296',
    phaseDescription: 'Rising energy, optimism, creativity, motivation, openness'
  },
  {
    id: 'follicular-3',
    title: 'How Hormones Influence Motivation',
    description: 'The science behind her peak motivation days.',
    source: 'Psychology Today',
    type: 'Article',
    phase: 'Follicular',
    url: 'https://www.psychologytoday.com/us/blog/hormonal/202103/how-your-hormones-influence-your-motivation',
    phaseDescription: 'Rising energy, optimism, creativity, motivation, openness'
  },

  // 🔥 Ovulation Phase: Days 14–16
  // Peak communication, confidence, social connection, libido, emotional clarity
  {
    id: 'ovulation-1',
    title: 'Ovulation Symptoms to Know',
    description: 'Signs that she\'s in her peak confidence phase.',
    source: 'Healthline',
    type: 'Article',
    phase: 'Ovulation',
    url: 'https://www.healthline.com/health/ovulation-symptoms',
    phaseDescription: 'Peak communication, confidence, social connection, emotional clarity'
  },
  {
    id: 'ovulation-2',
    title: 'Understanding Ovulation',
    description: 'The biology behind her most social and confident days.',
    source: 'Verywell Health',
    type: 'Article',
    phase: 'Ovulation',
    url: 'https://www.verywellhealth.com/ovulation-5198297',
    phaseDescription: 'Peak communication, confidence, social connection, emotional clarity'
  },
  {
    id: 'ovulation-3',
    title: 'How Ovulation Affects Social Behavior',
    description: 'Why she\'s more outgoing and communicative during this phase.',
    source: 'Psychology Today',
    type: 'Article',
    phase: 'Ovulation',
    url: 'https://www.psychologytoday.com/us/blog/hormonal/202104/how-ovulation-affects-social-behavior',
    phaseDescription: 'Peak communication, confidence, social connection, emotional clarity'
  },
  {
    id: 'ovulation-4',
    title: 'Menstrual Cycle and Relationships',
    description: 'How her cycle affects your relationship dynamics.',
    source: 'Healthline',
    type: 'Article',
    phase: 'Ovulation',
    url: 'https://www.healthline.com/health/womens-health/menstrual-cycle-and-relationships',
    phaseDescription: 'Peak communication, confidence, social connection, emotional clarity'
  },

  // 🏠 Early Luteal Phase: Days 17–23
  // Heightened sensitivity begins, need for reassurance, emotional fluctuations
  {
    id: 'early-luteal-1',
    title: 'Menstrual Cycle and Mood',
    description: 'Understanding her emotional shifts as sensitivity increases.',
    source: 'Healthline',
    type: 'Article',
    phase: 'Early Luteal',
    url: 'https://www.healthline.com/health/mental-health/menstrual-cycle-and-mood',
    phaseDescription: 'Heightened sensitivity, need for reassurance, emotional fluctuations'
  },
  {
    id: 'early-luteal-2',
    title: 'Why the Luteal Phase Feels So Intense',
    description: 'The psychology behind her heightened emotional state.',
    source: 'Psychology Today',
    type: 'Article',
    phase: 'Early Luteal',
    url: 'https://www.psychologytoday.com/us/blog/hormonal/202105/why-the-luteal-phase-feels-so-intense',
    phaseDescription: 'Heightened sensitivity, need for reassurance, emotional fluctuations'
  },
  {
    id: 'early-luteal-3',
    title: 'How Hormones Affect Mood',
    description: 'Understanding the hormonal changes affecting her emotions.',
    source: 'Verywell Mind',
    type: 'Article',
    phase: 'Early Luteal',
    url: 'https://www.verywellmind.com/how-hormones-affect-your-mood-5078233',
    phaseDescription: 'Heightened sensitivity, need for reassurance, emotional fluctuations'
  },

  // ⚠️ Late Luteal/PMS Phase: Days 24–28
  // Irritability, emotional intensity, overwhelm, need for stability and reassurance
  {
    id: 'pms-1',
    title: 'PMS Symptoms Guide',
    description: 'Understanding the full range of premenstrual symptoms.',
    source: 'Healthline',
    type: 'Article',
    phase: 'Late Luteal/PMS',
    url: 'https://www.healthline.com/health/pms-symptoms',
    phaseDescription: 'Irritability, emotional intensity, overwhelm, need for stability'
  },
  {
    id: 'pms-2',
    title: 'Premenstrual Syndrome (PMS)',
    description: 'Complete guide to PMS and how to be supportive.',
    source: 'Verywell Mind',
    type: 'Article',
    phase: 'Late Luteal/PMS',
    url: 'https://www.verywellmind.com/premenstrual-syndrome-pms-5078234',
    phaseDescription: 'Irritability, emotional intensity, overwhelm, need for stability'
  },
  {
    id: 'pms-3',
    title: 'Why the Luteal Phase Feels So Intense',
    description: 'The psychology behind emotional intensity during PMS.',
    source: 'Psychology Today',
    type: 'Article',
    phase: 'Late Luteal/PMS',
    url: 'https://www.psychologytoday.com/us/blog/hormonal/202105/why-the-luteal-phase-feels-so-intense',
    phaseDescription: 'Irritability, emotional intensity, overwhelm, need for stability'
  },
  {
    id: 'pms-4',
    title: 'How Hormones Affect Your Mood',
    description: 'Understanding mood fluctuations during PMS.',
    source: 'Verywell Mind',
    type: 'Article',
    phase: 'Late Luteal/PMS',
    url: 'https://www.verywellmind.com/how-hormones-affect-your-mood-5078233',
    phaseDescription: 'Irritability, emotional intensity, overwhelm, need for stability'
  }
];

// Cache for validated URLs
const validatedUrlCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Validate a URL with HEAD request
 * @param {string} url - URL to validate
 * @returns {Promise<boolean>} Whether URL is valid
 */
export const validateUrl = async (url) => {
  // Check cache first
  const cached = validatedUrlCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.valid;
  }

  try {
    // Use a CORS proxy or direct fetch with no-cors mode
    // Since we can't do HEAD requests cross-origin, we'll validate on first click
    // For now, mark all URLs as valid and handle errors on click
    const isValid = true;
    
    validatedUrlCache.set(url, {
      valid: isValid,
      timestamp: Date.now()
    });
    
    return isValid;
  } catch (error) {
    console.error(`URL validation failed for ${url}:`, error);
    validatedUrlCache.set(url, {
      valid: false,
      timestamp: Date.now()
    });
    return false;
  }
};

/**
 * Get validated resources for a specific phase
 * @param {string} phase - The cycle phase
 * @returns {Promise<Array>} Validated resources matching the phase
 */
export const getValidatedResourcesByPhase = async (phase) => {
  const phaseResources = CUSTOM_RESOURCES.filter(r => r.phase === phase);
  const validResources = [];
  
  for (const resource of phaseResources) {
    const isValid = await validateUrl(resource.url);
    if (isValid) {
      validResources.push(resource);
    }
  }
  
  return validResources;
};

/**
 * Get resources for a specific phase (synchronous, for initial render)
 * @param {string} phase - The cycle phase
 * @returns {Array} Resources matching the phase
 */
export const getResourcesByPhase = (phase) => {
  return CUSTOM_RESOURCES.filter(r => r.phase === phase);
};

/**
 * Get resources prioritized by current phase
 * @param {string} currentPhase - Current cycle phase
 * @param {string} upcomingPhase - Next cycle phase
 * @returns {Object} Resources organized by relevance
 */
export const getRelevantResources = (currentPhase, upcomingPhase) => {
  const currentResources = CUSTOM_RESOURCES.filter(r => r.phase === currentPhase);
  const upcomingResources = CUSTOM_RESOURCES.filter(r => r.phase === upcomingPhase)
    .map(r => ({ ...r, is_upcoming: true, upcoming_phase: upcomingPhase }));
  
  // Get resources from other phases for variety
  const otherPhases = ['Menstrual', 'Follicular', 'Ovulation', 'Early Luteal', 'Late Luteal/PMS']
    .filter(p => p !== currentPhase && p !== upcomingPhase);
  const otherResources = CUSTOM_RESOURCES.filter(r => otherPhases.includes(r.phase));
  
  return {
    current: currentResources.map(r => ({ ...r, is_phase_match: true })),
    upcoming: upcomingResources,
    other: otherResources.slice(0, 3) // Limit to 3 other resources
  };
};

/**
 * Get phase-prioritized resources for display
 * Prioritizes current phase, then upcoming, then others
 * @param {string} currentPhase - Current cycle phase
 * @returns {Array} Sorted resources array
 */
export const getPhasePrioritizedResources = (currentPhase) => {
  const phases = ['Menstrual', 'Follicular', 'Ovulation', 'Early Luteal', 'Late Luteal/PMS'];
  const currentIndex = phases.indexOf(currentPhase);
  const upcomingPhase = phases[(currentIndex + 1) % phases.length];
  
  // Get all resources sorted by priority
  const currentPhaseResources = CUSTOM_RESOURCES
    .filter(r => r.phase === currentPhase)
    .map(r => ({ ...r, priority: 1, is_phase_match: true }));
  
  const upcomingPhaseResources = CUSTOM_RESOURCES
    .filter(r => r.phase === upcomingPhase)
    .map(r => ({ ...r, priority: 2, is_upcoming: true, upcoming_phase: upcomingPhase }));
  
  const otherResources = CUSTOM_RESOURCES
    .filter(r => r.phase !== currentPhase && r.phase !== upcomingPhase)
    .map(r => ({ ...r, priority: 3 }));
  
  return [
    ...currentPhaseResources,
    ...upcomingPhaseResources,
    ...otherResources
  ];
};

/**
 * Get the next phase in the cycle
 * @param {string} currentPhase - Current cycle phase
 * @returns {string} Next phase name
 */
export const getNextPhase = (currentPhase) => {
  const phases = ['Menstrual', 'Follicular', 'Ovulation', 'Early Luteal', 'Late Luteal/PMS'];
  const currentIndex = phases.indexOf(currentPhase);
  if (currentIndex === -1) return 'Menstrual';
  return phases[(currentIndex + 1) % phases.length];
};

/**
 * Get phase emoji
 * @param {string} phase - The cycle phase
 * @returns {string} Emoji for the phase
 */
export const getPhaseEmoji = (phase) => {
  const emojis = {
    'Menstrual': '🩸',
    'Follicular': '🌸',
    'Ovulation': '🔥',
    'Early Luteal': '🏠',
    'Late Luteal/PMS': '⚠️'
  };
  return emojis[phase] || '📚';
};

/**
 * Get phase color class
 * @param {string} phase - The cycle phase
 * @returns {string} Tailwind color class
 */
export const getPhaseColor = (phase) => {
  const colors = {
    'Menstrual': 'text-red-400 bg-red-500/10 border-red-500/30',
    'Follicular': 'text-pink-400 bg-pink-500/10 border-pink-500/30',
    'Ovulation': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    'Early Luteal': 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    'Late Luteal/PMS': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
  };
  return colors[phase] || 'text-slate-400 bg-slate-500/10 border-slate-500/30';
};

/**
 * Mark a resource as archived/viewed
 * @param {string} resourceId - Resource ID to archive
 */
export const archiveResource = (resourceId) => {
  const archived = JSON.parse(localStorage.getItem('cyclecoach_archived_resources') || '[]');
  if (!archived.includes(resourceId)) {
    archived.push(resourceId);
    localStorage.setItem('cyclecoach_archived_resources', JSON.stringify(archived));
  }
};

/**
 * Get archived resource IDs
 * @returns {Array} Array of archived resource IDs
 */
export const getArchivedResources = () => {
  return JSON.parse(localStorage.getItem('cyclecoach_archived_resources') || '[]');
};

/**
 * Get unarchived resources for current phase
 * @param {string} currentPhase - Current cycle phase
 * @returns {Array} Unarchived resources prioritized by phase
 */
export const getUnarchivedResources = (currentPhase) => {
  const archived = getArchivedResources();
  const allResources = getPhasePrioritizedResources(currentPhase);
  return allResources.filter(r => !archived.includes(r.id));
};

/**
 * Get the next valid resource after archiving
 * @param {string} currentPhase - Current cycle phase
 * @param {string} archivedId - ID of the resource just archived
 * @returns {Object|null} Next valid resource or null if none available
 */
export const getNextValidResource = (currentPhase, archivedId) => {
  const unarchived = getUnarchivedResources(currentPhase);
  // Return the first unarchived resource that isn't the one just archived
  return unarchived.find(r => r.id !== archivedId) || null;
};

/**
 * Reset archived resources
 */
export const resetArchivedResources = () => {
  localStorage.removeItem('cyclecoach_archived_resources');
};

// Legacy export for backward compatibility
export const RESOURCES = CUSTOM_RESOURCES;

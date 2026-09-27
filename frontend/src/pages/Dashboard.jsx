import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import MoodMap from '@/components/MoodMap';
import FeedbackModal from '@/components/FeedbackModal';
import PartnerProfile from '@/components/PartnerProfile';
import CoachingManual from '@/components/CoachingManual';
import PhaseDetailModal from '@/components/PhaseDetailModal';
import PartnerSetupForm from '@/components/dashboard/PartnerSetupForm';
import AIWingmanTab from '@/components/dashboard/AIWingmanTab';
import CycleHistoryDialog from '@/components/dashboard/CycleHistoryDialog';
import UpgradeModal from '@/components/dashboard/UpgradeModal';
import { PHASE_CONTENT, dateSeedPick } from '@/utils/phaseContent';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const API = BACKEND_URL;

import { LocalStorage } from '../utils/localStorageManager';
import { calculateCycleDay, getPhaseInfo, recalculateCycleLengths, calculateStatistics, predictNextPeriod, getDisplayCycleDay, getCycleExtensionStatus, getCappedCycleMessages, calculateEWMA } from '../utils/cycleCalculations';
import { RESOURCES, getRelevantResources, getNextPhase, getPhasePrioritizedResources, getUnarchivedResources, archiveResource, getPhaseEmoji, getPhaseColor, getPhaseLabel, getPhaseDays, PHASE_LABELS } from '../utils/resourcesData';
import { getUnseenFact } from '../utils/cycleFacts';
import { initializeNotifications, runNotificationChecks, rescheduleNotifications, getDay1DismissedMessage } from '../utils/notificationService';

const Dashboard = () => {
  // LOCAL-ONLY MODE: No user prop needed
  const [partner, setPartner] = useState(null);
  const [cycleInfo, setCycleInfo] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [funFact, setFunFact] = useState(null);
  const [currentResources, setCurrentResources] = useState([]);
  const [upcomingResources, setUpcomingResources] = useState([]);
  const [generalResources, setGeneralResources] = useState([]);
  const [bookmarkedResources, setBookmarkedResources] = useState([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showCycleHistory, setShowCycleHistory] = useState(false);
  const [showPhaseDetail, setShowPhaseDetail] = useState(false);
  const [cycleHistory, setCycleHistory] = useState(null);
  const [logPeriodDate, setLogPeriodDate] = useState('');
  const [cycleSettings] = useState(() => LocalStorage.getCycleSettings());
  
  // Subscription tier state (for feedback prompts)
  const [subscriptionTier, setSubscriptionTier] = useState(null);

  // Derive plan type from stored user data
  const getUserPlanType = () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) return 'none';
      const user = JSON.parse(userData);
      return user.plan_type || user.subscription_tier || 'none';
    } catch { return 'none'; }
  };
  const [planType, setPlanType] = useState(getUserPlanType);

  const hasAIAccess = planType === 'trial' || planType === 'advanced' || planType === 'grandfathered';
  const isFullTier = planType === 'advanced' || planType === 'grandfathered';
  
  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState(null);

  // Extension tracking state
  const [extensionStatus, setExtensionStatus] = useState('normal');
  const [showExtensionBanner, setShowExtensionBanner] = useState(false);
  const [extensionConfirmed, setExtensionConfirmed] = useState(null);
  const [cappedMessage, setCappedMessage] = useState('');
  const [actualCycleDay, setActualCycleDay] = useState(null);
  const [averageCycleLength, setAverageCycleLength] = useState(28);
  const [showDenyDatePicker, setShowDenyDatePicker] = useState(false);
  const [denyDate, setDenyDate] = useState('');
  const [personalizedTips, setPersonalizedTips] = useState([]);
  const [loadingPersonalizedTips, setLoadingPersonalizedTips] = useState(false);

  // Setup form
  const [partnerName, setPartnerName] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState('');

  // Helper to render text with bold markdown
  useEffect(() => {
    loadData();
    checkForFeedbackPrompt();
    
    // Initialize push notifications
    initializeNotifications().then(enabled => {
      if (enabled) {
        // Run notification checks on load
        runNotificationChecks();
        
        // Also run when app comes back to focus
        const handleVisibilityChange = () => {
          if (!document.hidden) {
            runNotificationChecks();
          }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    });

    // Check if Day 1 check-in was dismissed (native "Not Yet" action)
    const dismissedMsg = getDay1DismissedMessage();
    if (dismissedMsg) {
      setTimeout(() => toast.info(dismissedMsg, { duration: 8000 }), 1500);
    }
  }, []);
  
  // Check if we should show a feedback prompt
  const checkForFeedbackPrompt = async () => {
    const tier = LocalStorage.getSubscriptionTier();
    if (!tier?.email) return;
    
    try {
      const response = await fetch(`${API}/api/feedback/check/${encodeURIComponent(tier.email)}`);
      if (!response.ok) return;
      const result = await response.json();
      
      if (result.should_prompt && result.prompt_type) {
        // Small delay so dashboard loads first
        setTimeout(() => {
          setFeedbackType(result.prompt_type);
          setShowFeedbackModal(true);
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking feedback status:', error);
    }
  };

  // Aggressive scroll to top to prevent Radix Tabs auto-scroll
  useEffect(() => {
    // Prevent any scroll restoration
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const forceScrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    
    // Immediate scroll
    forceScrollToTop();
    
    // Multiple delayed scrolls to override any async behavior from Radix
    const timers = [0, 10, 50, 100, 150, 200, 300, 500].map(delay => 
      setTimeout(forceScrollToTop, delay)
    );
    
    return () => {
      timers.forEach(clearTimeout);
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'auto';
      }
    };
  }, []);

  // Removed: was causing scroll-to-top on every partner state update (including preferences)

  const loadData = () => {
    try {
      // Ensure LocalStorage is initialized with current user ID
      try {
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        if (userData.id) LocalStorage.setUser(userData.id);
      } catch { /* ignore localStorage error */ }

      // Load subscription tier info
      const tierData = LocalStorage.getSubscriptionTier();
      if (tierData) {
        setSubscriptionTier(tierData);
      }
      setPlanType(getUserPlanType());
      
      // LOCAL-ONLY: Load from localStorage
      const profile = LocalStorage.getPartnerProfile();
      if (profile) {
        // Sync with most recent cycle from history
        let history = LocalStorage.getCycleHistory();
        
        // If no history but profile has a cycleStartDate, create initial entry
        if ((!history || history.length === 0) && profile.cycleStartDate) {
          LocalStorage.addCycleEntry({
            cycle_start_date: profile.cycleStartDate,
            cycle_length: null,
            status: 'current'
          });
          history = LocalStorage.getCycleHistory();
        }
        
        if (history && history.length > 0) {
          const recalculated = recalculateCycleLengths(history);
          const mostRecentCycle = recalculated[recalculated.length - 1];
          
          // Update profile if the most recent cycle is different
          if (mostRecentCycle && profile.cycleStartDate !== mostRecentCycle.cycle_start_date) {
            console.log('Syncing profile with most recent cycle:', mostRecentCycle.cycle_start_date);
            profile.cycleStartDate = mostRecentCycle.cycle_start_date;
            LocalStorage.savePartnerProfile(profile);
          }
        }
        
        setPartner(profile);
        loadCycleInfoLocal(profile);
        
        // Load static resources
        loadStaticResources(profile);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStaticResources = (profile) => {
    try {
      const history = LocalStorage.getCycleHistory();
      const recalculated = recalculateCycleLengths(history);
      const stats = calculateStatistics(recalculated);
      const avgLength = stats.ewma_length || 28;

      const cycleDay = calculateCycleDay(profile.cycleStartDate);
      const phaseInfo = getPhaseInfo(cycleDay, avgLength, cycleSettings.menstrualLength, cycleSettings.lutealConstant);
      const nextPhase = getNextPhase(phaseInfo.phase);
      
      // Get unarchived resources prioritized by current phase
      const unarchivedResources = getUnarchivedResources(phaseInfo.phase);
      
      // Filter current phase resources (recommended for today) - limit to 3
      const currentPhaseResources = unarchivedResources
        .filter(r => r.phase === phaseInfo.phase)
        .map(r => ({ ...r, is_recommended: true }));
      
      // Get upcoming phase resources - limit to 2
      const upcomingPhaseResources = RESOURCES
        .filter(r => r.phase === nextPhase)
        .map(r => ({ ...r, is_upcoming: true, upcoming_phase: nextPhase }));
      
      // Get general/full-cycle resources - limit to 1
      const generalPhaseResources = unarchivedResources
        .filter(r => r.phase === 'Full-Cycle')
        .map(r => ({ ...r, is_general: true }));
      
      // Display limited resources per section
      setCurrentResources(currentPhaseResources.slice(0, 3));
      setUpcomingResources(upcomingPhaseResources.slice(0, 2));
      setGeneralResources(generalPhaseResources.slice(0, 1));
    } catch (error) {
      console.error('Error loading resources:', error);
      // Fallback to first 3 resources
      setCurrentResources(RESOURCES.slice(0, 3));
      setUpcomingResources([]);
      setGeneralResources([]);
    }
  };

  const loadCycleInfoLocal = (profile) => {
    try {
      const history = LocalStorage.getCycleHistory();
      const recalculated = recalculateCycleLengths(history);
      const stats = calculateStatistics(recalculated);
      const avgLength = stats.ewma_length || 28;
      setAverageCycleLength(avgLength);

      const cycleDay = calculateCycleDay(profile.cycleStartDate);
      setActualCycleDay(cycleDay);

      const phaseInfo = getPhaseInfo(cycleDay, avgLength, cycleSettings.menstrualLength, cycleSettings.lutealConstant);
      const { displayDay, isCapped } = getDisplayCycleDay(cycleDay, avgLength);
      const status = getCycleExtensionStatus(cycleDay, avgLength);
      setExtensionStatus(status);

      setCycleInfo({
        cycle_day: displayDay,
        actual_day: cycleDay,
        is_capped: isCapped,
        phase: phaseInfo.phase,
        phase_number: phaseInfo.phase_number,
        phase_day: phaseInfo.phase_day,
        emoji: phaseInfo.emoji,
        punchline: phaseInfo.punchline,
        briefPlayByPlay: phaseInfo.briefPlayByPlay,
        briefFeelings: phaseInfo.briefFeelings,
        prep: phaseInfo.prep,
        action: phaseInfo.action,
        fullContent: phaseInfo.fullContent,
        isEstimate: stats.total_cycles_tracked === 0,
      });

      // Check extension state
      const extState = LocalStorage.getExtensionState();
      if (status === 'extended' || status === 'capped') {
        // Show banner if not yet confirmed/denied for this cycle
        if (!extState || extState.alertShownForCycleStart !== profile.cycleStartDate || extState.confirmed === null) {
          setShowExtensionBanner(true);
          setExtensionConfirmed(null);
        } else {
          setExtensionConfirmed(extState.confirmed);
          setShowExtensionBanner(false);
        }
      } else {
        setShowExtensionBanner(false);
        setExtensionConfirmed(null);
      }

      // Set capped message
      if (status === 'capped') {
        const messages = getCappedCycleMessages();
        setCappedMessage(messages[Math.floor(Math.random() * messages.length)]);
      }

      // Set fun fact
      const researchFact = getUnseenFact(phaseInfo.phase);
      setFunFact({ 
        fact: researchFact.fact, 
        practical: researchFact.practical,
        source: researchFact.source,
        phase: phaseInfo.phase 
      });
    } catch (error) {
      console.error('Error calculating cycle info:', error);
    }
  };

  // LOCAL-ONLY: Refresh fun fact from research database
  const loadFunFact = () => {
    if (!cycleInfo) return;
    const researchFact = getUnseenFact(cycleInfo.phase);
    setFunFact({ 
      fact: researchFact.fact, 
      practical: researchFact.practical,
      source: researchFact.source,
      phase: cycleInfo.phase 
    });
  };

  // Fetch AI-personalized tips (Advanced plan only)
  const fetchPersonalizedTips = async () => {
    if (!hasAIAccess || planType === 'basic' || !cycleInfo || !partner) return;
    setLoadingPersonalizedTips(true);
    try {
      const partnerContext = {
        partner_name: partner.partnerName,
        cycle_length: partner.cycleLength || 28,
        preferences: partner.preferences || {}
      };
      // Get recent chat history from localStorage
      const chatHistory = LocalStorage.getChatHistory();

      const response = await fetch(`${API}/api/tips/personalized`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycle_day: cycleInfo.actual_day || cycleInfo.cycle_day,
          phase: cycleInfo.phase,
          partner_profile: partnerContext,
          chat_history: chatHistory.slice(-15)
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.tips && data.tips.length > 0) {
          setPersonalizedTips(data.tips);
        }
      }
    } catch (e) {
      console.error('Personalized tips error:', e);
    } finally {
      setLoadingPersonalizedTips(false);
    }
  };

  const handleCreatePartner = (e) => {
    e.preventDefault();
    try {
      // LOCAL-ONLY: Save to localStorage
      const newPartner = {
        id: Date.now().toString(),
        partnerName: partnerName,
        cycleStartDate: cycleStartDate,
        cycleLength: 28,
        preferences: {}, // Initialize empty preferences object
        createdAt: new Date().toISOString()
      };
      LocalStorage.savePartnerProfile(newPartner);
      
      // Also add the initial cycle to cycle history
      LocalStorage.addCycleEntry({
        cycle_start_date: cycleStartDate,
        cycle_length: null,
        status: 'current'
      });
      
      setPartner(newPartner);
      loadCycleInfoLocal(newPartner);
      loadStaticResources(newPartner);
      rescheduleNotifications();
      toast.success('Partner profile created!');
    } catch (error) {
      console.error('Error creating partner:', error);
      toast.error('Failed to create partner profile');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMsg = chatMessage;
    setChatMessage('');

    // Add user message to history immediately
    setChatHistory(prev => [...prev, { message: userMsg, response: '...' }]);

    try {
      // ANONYMOUS CHAT: Include Partner Profile for personalization
      // Partner Profile is cached locally - no external API calls
      const partnerContext = partner ? {
        partner_name: partner.partnerName,
        preferences: partner.preferences || {},
        cycle_length: partner.cycleLength
      } : null;

      const response = await axios.post(
        `${API}/api/chat/anonymous`,
        {
          message: userMsg,
          cycle_day: cycleInfo?.cycle_day,
          phase: cycleInfo?.phase,
          partner_profile: partnerContext
        }
      );

      // Update with AI response
      setChatHistory(prev => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1] = {
          message: userMsg,
          response: response.data.response
        };
        return newHistory;
      });

      // Persist chat for personalized tips
      try {
        const stored = LocalStorage.getChatHistory();
        stored.push(
          { role: 'user', text: userMsg, date: new Date().toISOString(), cycle_day: cycleInfo?.cycle_day },
          { role: 'assistant', text: response.data.response, date: new Date().toISOString() }
        );
        LocalStorage.saveChatHistory(stored.slice(-50));
      } catch { /* ignore save error */ }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      setChatHistory(prev => prev.slice(0, -1));
    }
  };

  const updatePreference = (key, value) => {
    if (!value.trim() || !partner) return;
    
    try {
      // LOCAL-ONLY: Save to localStorage
      const updatedPartner = {
        ...partner,
        preferences: {
          ...partner.preferences,
          [key]: value
        }
      };
      
      LocalStorage.savePartnerProfile(updatedPartner);
      setPartner(updatedPartner);
      
      toast.success('Preference saved!');
    } catch (error) {
      console.error('Error saving preference:', error);
      toast.error('Failed to save preference');
    }
  };

  const handleArchiveResource = (resourceId) => {
    if (!partner || !cycleInfo) return;
    
    try {
      // Archive the resource in localStorage
      archiveResource(resourceId);
      
      // Get remaining unarchived resources prioritized by phase
      const unarchivedResources = getUnarchivedResources(cycleInfo.phase);
      const nextPhase = getNextPhase(cycleInfo.phase);
      
      // Update current resources - limit to 3
      const currentPhaseResources = unarchivedResources
        .filter(r => r.phase === cycleInfo.phase)
        .map(r => ({ ...r, is_recommended: true }));
      setCurrentResources(currentPhaseResources.slice(0, 3));
      
      // Update upcoming resources - limit to 2
      const upcomingPhaseResources = RESOURCES
        .filter(r => r.phase === nextPhase)
        .map(r => ({ ...r, is_upcoming: true, upcoming_phase: nextPhase }));
      setUpcomingResources(upcomingPhaseResources.slice(0, 2));
      
      // Update general resources - limit to 1
      const generalPhaseResources = unarchivedResources
        .filter(r => r.phase === 'Full-Cycle')
        .map(r => ({ ...r, is_general: true }));
      setGeneralResources(generalPhaseResources.slice(0, 1));
      
      toast.success('Resource archived! Loading next article...');
    } catch (error) {
      console.error('Error archiving resource:', error);
      toast.error('Failed to archive');
    }
  };

  const handleBookmarkResource = (resourceId) => {
    if (!partner || !cycleInfo) return;
    
    try {
      // Find the resource from any of the resource lists
      const bookmarkedResource = currentResources.find(r => r.id === resourceId) 
        || upcomingResources.find(r => r.id === resourceId)
        || generalResources.find(r => r.id === resourceId);
      
      if (bookmarkedResource) {
        // Check if already bookmarked
        if (!bookmarkedResources.find(r => r.id === resourceId)) {
          setBookmarkedResources(prev => [...prev, bookmarkedResource]);
          toast.success('Resource bookmarked!');
        } else {
          toast.info('Already bookmarked!');
        }
      }
      
      // Archive the resource and reload all sections
      archiveResource(resourceId);
      const unarchivedResources = getUnarchivedResources(cycleInfo.phase);
      const nextPhase = getNextPhase(cycleInfo.phase);
      
      // Update current resources - limit to 3
      const currentPhaseResources = unarchivedResources
        .filter(r => r.phase === cycleInfo.phase)
        .map(r => ({ ...r, is_recommended: true }));
      setCurrentResources(currentPhaseResources.slice(0, 3));
      
      // Update upcoming resources - limit to 2
      const upcomingPhaseResources = RESOURCES
        .filter(r => r.phase === nextPhase)
        .map(r => ({ ...r, is_upcoming: true, upcoming_phase: nextPhase }));
      setUpcomingResources(upcomingPhaseResources.slice(0, 2));
      
      // Update general resources - limit to 1
      const generalPhaseResources = unarchivedResources
        .filter(r => r.phase === 'Full-Cycle')
        .map(r => ({ ...r, is_general: true }));
      setGeneralResources(generalPhaseResources.slice(0, 1));
    } catch (error) {
      console.error('Error bookmarking resource:', error);
      toast.error('Failed to bookmark');
    }
  };

  const loadMoreResources = () => {
    if (!cycleInfo) return;
    
    try {
      // Get unarchived resources prioritized by current phase
      const unarchivedResources = getUnarchivedResources(cycleInfo.phase);
      const nextPhase = getNextPhase(cycleInfo.phase);
      
      // Update current resources - limit to 3
      const currentPhaseResources = unarchivedResources
        .filter(r => r.phase === cycleInfo.phase)
        .map(r => ({ ...r, is_recommended: true }));
      setCurrentResources(currentPhaseResources.slice(0, 3));
      
      // Update upcoming resources - limit to 2
      const upcomingPhaseResources = RESOURCES
        .filter(r => r.phase === nextPhase)
        .map(r => ({ ...r, is_upcoming: true, upcoming_phase: nextPhase }));
      setUpcomingResources(upcomingPhaseResources.slice(0, 2));
      
      // Update general resources - limit to 1
      const generalPhaseResources = unarchivedResources
        .filter(r => r.phase === 'Full-Cycle')
        .map(r => ({ ...r, is_general: true }));
      setGeneralResources(generalPhaseResources.slice(0, 1));
    } catch (error) {
      console.error('Error loading more resources:', error);
    }
  };

  const loadNextResources = () => {
    loadMoreResources();
  };

  const handleLogPeriod = (e) => {
    e.preventDefault();
    if (!logPeriodDate || !partner) return;
    
    // Validate: don't allow future dates
    const selectedDate = new Date(logPeriodDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate > today) {
      toast.error('Cannot log a future date');
      return;
    }
    
    try {
      // LOCAL-ONLY: Add cycle entry to localStorage
      LocalStorage.addCycleEntry({
        cycle_start_date: logPeriodDate,
        cycle_length: null,
        status: 'current'
      });
      
      // Update partner profile with most recent cycle start date
      const history = LocalStorage.getCycleHistory();
      const recalculated = recalculateCycleLengths(history);
      
      console.log('After logging period:');
      console.log('- Total cycles:', recalculated.length);
      console.log('- Recalculated history:', recalculated);
      
      if (recalculated.length > 0) {
        const mostRecentCycle = recalculated[recalculated.length - 1];
        console.log('- Most recent cycle:', mostRecentCycle);
        console.log('- Most recent date:', mostRecentCycle.cycle_start_date);
        
        const updatedPartner = {
          ...partner,
          cycleStartDate: mostRecentCycle.cycle_start_date
        };
        LocalStorage.savePartnerProfile(updatedPartner);
        setPartner(updatedPartner);
        console.log('- Updated partner cycleStartDate to:', updatedPartner.cycleStartDate);
        loadCycleInfoLocal(updatedPartner);
      }
      
      rescheduleNotifications();
      toast.success('Period logged!');
      setLogPeriodDate('');
      
      // Reload cycle history display
      loadCycleHistory();
    } catch (error) {
      console.error('Error logging period:', error);
      toast.error('Failed to log period');
    }
  };

  const loadCycleHistory = () => {
    try {
      const history = LocalStorage.getCycleHistory();
      const recalculated = recalculateCycleLengths(history);
      const stats = calculateStatistics(recalculated);
      
      let prediction = { next_period_date: null, days_until_next: 0 };
      if (recalculated.length > 0) {
        prediction = predictNextPeriod(
          recalculated[recalculated.length - 1].cycle_start_date,
          stats.average_length
        );
      }
      
      setCycleHistory({
        history: recalculated.reverse(), // Most recent first
        statistics: stats,
        prediction: prediction
      });
    } catch (error) {
      console.error('Error loading cycle history:', error);
    }
  };

  const handleDeleteCycle = (cycleId) => {
    if (!cycleId) {
      toast.error('Cannot delete: No cycle ID');
      return;
    }
    
    try {
      // LOCAL-ONLY: Remove from localStorage
      LocalStorage.deleteCycleEntry(cycleId);
      
      // Get updated history
      const updatedHistory = LocalStorage.getCycleHistory();
      
      // If there are remaining cycles, update partner profile with the most recent one
      if (updatedHistory.length > 0) {
        // Recalculate to get proper ordering
        const recalculated = recalculateCycleLengths(updatedHistory);
        const mostRecent = recalculated[recalculated.length - 1];
        
        if (mostRecent) {
          // Update partner profile with new current cycle start date
          const updatedPartner = {
            ...partner,
            cycleStartDate: mostRecent.cycle_start_date
          };
          LocalStorage.savePartnerProfile(updatedPartner);
          setPartner(updatedPartner);
        }
      }
      
      toast.success('Cycle entry deleted');
      
      // Reload
      rescheduleNotifications();
      loadCycleHistory();
      loadCycleInfoLocal(partner);
    } catch (error) {
      console.error('Error deleting cycle:', error);
      toast.error('Failed to delete');
    }
  };

  // All plans now include full features - no feature gating needed
  const hasPartnerProfile = () => true;
  const hasAIWingman = () => true;

  // In-app upgrade — redirects to Stripe Checkout (no auto-upgrade)
  const [upgrading, setUpgrading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleUpgradeToAdvanced = () => {
    setShowUpgradeModal(true);
  };

  const handleUpgradeCheckout = async () => {
    const sessionToken = localStorage.getItem('session_token');
    if (!sessionToken) { window.location.href = '/pricing'; return; }

    setUpgrading(true);
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      let useCheckout = !userData.stripe_subscription_id;

      // Try in-place upgrade first if user has a subscription
      if (!useCheckout) {
        const res = await fetch(`${API}/api/subscription/upgrade`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionToken}` },
        });
        let data;
        try { data = await res.json(); } catch { data = {}; }
        if (res.ok && data.success) {
          setPlanType('advanced');
          try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            u.plan_type = 'advanced';
            u.subscription_tier = 'advanced';
            localStorage.setItem('user', JSON.stringify(u));
          } catch { /* ignore */ }
          setShowUpgradeModal(false);
          toast.success('Upgraded to Advanced! AI Wingman is now unlocked.');
          window.location.reload();
          return;
        }
        // If upgrade endpoint says use checkout, fall through
        if (data.use_checkout) {
          useCheckout = true;
          // Clear stale subscription_id from localStorage
          try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            u.stripe_subscription_id = null;
            localStorage.setItem('user', JSON.stringify(u));
          } catch { /* ignore */ }
        } else {
          throw new Error(data.detail || 'Failed to upgrade');
        }
      }

      // Redirect to Stripe Checkout for new subscription
      if (useCheckout) {
        const origin = window.location.origin;
        const res = await fetch(`${API}/api/subscription/create-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            plan: 'advanced',
            success_url: `${origin}/checkout-success?plan=advanced`,
            cancel_url: `${origin}/app`,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to create checkout');
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
      setUpgrading(false);
    }
  };

  // Extension confirm/deny handlers
  const handleConfirmExtension = () => {
    LocalStorage.saveExtensionState({
      confirmed: true,
      alertShownForCycleStart: partner?.cycleStartDate,
      cappedMessageShown: extensionStatus === 'capped'
    });
    setExtensionConfirmed(true);
    setShowExtensionBanner(false);
    toast.success('Extension confirmed. Average will update when her next period starts.');
  };

  const handleDenyExtension = () => {
    setShowDenyDatePicker(true);
  };

  const handleSubmitDenyDate = (e) => {
    e.preventDefault();
    if (!denyDate || !partner) return;

    const selectedDate = new Date(denyDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate > today) {
      toast.error('Cannot set a future date');
      return;
    }

    // Add a new cycle entry with the corrected Day 1
    LocalStorage.addCycleEntry({
      cycle_start_date: denyDate,
      cycle_length: null,
      status: 'current'
    });

    // Update partner profile
    const updatedPartner = { ...partner, cycleStartDate: denyDate };
    LocalStorage.savePartnerProfile(updatedPartner);
    setPartner(updatedPartner);

    // Clear extension state
    LocalStorage.clearExtensionState();
    setShowExtensionBanner(false);
    setShowDenyDatePicker(false);
    setExtensionConfirmed(null);
    setExtensionStatus('normal');
    setDenyDate('');

    // Reload everything
    loadCycleInfoLocal(updatedPartner);
    loadStaticResources(updatedPartner);
    rescheduleNotifications();
    toast.success('Cycle reset to new Day 1!');
  };

  const getPhaseColor = (phase) => {
    switch (phase) {
      case 'Menstrual':
        return 'from-red-500/20 to-pink-500/20 border-red-500/30';
      case 'Follicular':
        return 'from-green-500/20 to-emerald-500/20 border-green-500/30';
      case 'Ovulation':
        return 'from-pink-500/20 to-rose-500/20 border-pink-500/30';
      case 'Early Luteal':
        return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30';
      case 'Late Luteal/PMS':
        return 'from-orange-500/20 to-red-500/20 border-orange-500/30';
      default:
        return 'from-slate-500/20 to-slate-600/20 border-slate-500/30';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading dashboard...</div>
      </div>
    );
  }

  // If no partner profile, show setup
  if (!partner) {
    return (
      <PartnerSetupForm
        partnerName={partnerName}
        setPartnerName={setPartnerName}
        cycleStartDate={cycleStartDate}
        setCycleStartDate={setCycleStartDate}
        onSubmit={handleCreatePartner}
      />
    );
  }

  // Main Dashboard
  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-3 mb-8">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <img src="https://customer-assets.emergentagent.com/job_partner-cycle/artifacts/mdtjfodq_Cycle%20Coach%20Circle%20Icon.png" alt="Cycle Coach" className="w-10 h-10 flex-shrink-0 object-contain" />
              <h1 className="text-2xl sm:text-3xl font-bold" data-testid="dashboard-title"><span className="text-white">Cycle</span><span className="text-cyan-400">Coach</span></h1>
            </div>
            {partner && <p className="text-slate-400 mt-1 text-sm sm:text-base truncate">Tracking {partner.partnerName}&apos;s cycle</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => window.location.href = '/account'}
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs sm:text-sm"
              data-testid="account-settings-btn"
            >
              ⚙️ Account
            </Button>
            <Button
              onClick={() => window.location.href = '/privacy'}
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs sm:text-sm"
              data-testid="privacy-settings-btn"
            >
              🔒 Privacy
            </Button>
          </div>
        </div>

        {/* Trial Banner — hidden per product decision (users informed at signup) */}
        {false && planType === 'trial' && (() => {
          try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            const trialEnd = userData.trial_ends_at ? new Date(userData.trial_ends_at) : null;
            if (!trialEnd) return null;
            const now = new Date();
            const daysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
            return (
              <div className="bg-cyan-500/15 border border-cyan-500/30 backdrop-blur-sm p-4 rounded-2xl mb-4" data-testid="trial-banner">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎯</span>
                    <div>
                      <span className="text-white font-semibold text-sm">Free Trial — {daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>
                      <p className="text-cyan-300/70 text-xs mt-0.5">All features unlocked. Auto-bills $5/mo Basic after trial.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleUpgradeToAdvanced}
                      disabled={upgrading}
                      size="sm"
                      className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs"
                      data-testid="trial-upgrade-btn"
                    >
                      {upgrading ? '...' : 'Upgrade to Advanced'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          } catch { return null; }
        })()}

        {/* Extension Alert Banner */}
        {showExtensionBanner && cycleInfo && (
          <div className="bg-orange-500/20 border border-orange-500/40 backdrop-blur-sm p-4 sm:p-6 rounded-2xl mb-4" data-testid="extension-banner">
            {!showDenyDatePicker ? (
              <div>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📋</span>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-lg">Cycle Extended — Day {cycleInfo.actual_day || cycleInfo.cycle_day}</h3>
                    <p className="text-orange-200 text-sm mt-1">
                      Periods can vary — confirm if {partner?.partnerName || 'your partner'}&apos;s cycle has extended past the usual {averageCycleLength} days.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-4">
                      <Button
                        onClick={handleConfirmExtension}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        size="sm"
                        data-testid="confirm-extension-btn"
                      >
                        Yes, her period hasn&apos;t started yet
                      </Button>
                      <Button
                        onClick={handleDenyExtension}
                        variant="outline"
                        className="border-orange-400 text-orange-300 hover:bg-orange-500/20"
                        size="sm"
                        data-testid="deny-extension-btn"
                      >
                        No, it already started — enter date
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-white font-semibold mb-2">When did her period actually start?</h3>
                <form onSubmit={handleSubmitDenyDate} className="flex flex-wrap gap-2 items-end">
                  <DatePicker
                    value={denyDate}
                    onChange={(val) => setDenyDate(val)}
                    max={new Date().toISOString().split('T')[0]}
                    placeholder="Select date"
                    testId="deny-date-input"
                  />
                  <Button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-white" size="sm" data-testid="deny-date-submit">
                    Set as Day 1
                  </Button>
                  <Button onClick={() => setShowDenyDatePicker(false)} variant="ghost" size="sm" className="text-slate-300">
                    Cancel
                  </Button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Capped Cycle Message */}
        {extensionStatus === 'capped' && cappedMessage && !showExtensionBanner && (
          <div className="bg-purple-500/20 border border-purple-500/30 backdrop-blur-sm p-4 rounded-2xl mb-4" data-testid="capped-cycle-message">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🤷</span>
              <div>
                <p className="text-purple-200 text-sm">{cappedMessage}</p>
                <p className="text-purple-300/60 text-xs mt-1">Internal count: Day {actualCycleDay}</p>
              </div>
            </div>
          </div>
        )}

        {/* Current Cycle Info */}
        {cycleInfo && (
          <div className={`bg-gradient-to-r ${getPhaseColor(cycleInfo.phase)} backdrop-blur-sm p-4 sm:p-6 rounded-2xl border mb-8`} data-testid="cycle-info-card">
            {/* Header: icon + phase name + punchline */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                {cycleInfo.emoji && <span className="text-2xl">{cycleInfo.emoji}</span>}
                <span className="text-xl sm:text-2xl font-bold text-white" data-testid="current-phase">{cycleInfo.phase}</span>
              </div>
              <p className="text-slate-300 text-sm" data-testid="phase-punchline-card">{cycleInfo.punchline}</p>
              {cycleInfo.isEstimate && (
                <p className="text-amber-400/70 text-xs mt-1" data-testid="estimate-disclaimer-dashboard">Estimated cycle &mdash; accuracy improves with more data.</p>
              )}
            </div>

            {/* Stat row: Overall Cycle + Phase Progress side by side */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Overall Cycle</div>
                <div className="text-xl font-bold text-white" data-testid="cycle-day">
                  Day {cycleInfo.cycle_day}{cycleInfo.is_capped ? '+' : ''}
                </div>
                {extensionStatus !== 'normal' && (
                  <div className="text-[10px] text-orange-300">Avg: {averageCycleLength}d</div>
                )}
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Phase Progress</div>
                <div className="text-xl font-bold text-white" data-testid="phase-day">
                  Phase {cycleInfo.phase_number}: Day {cycleInfo.phase_day}
                </div>
              </div>
            </div>

            {/* Button row: History + Predictor side by side */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Button
                onClick={() => {
                  setShowCycleHistory(!showCycleHistory);
                  if (!cycleHistory) loadCycleHistory();
                }}
                variant="outline"
                size="sm"
                className="border-white/20 text-white hover:bg-white/10 text-xs"
                data-testid="toggle-cycle-history-button"
              >
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                History
              </Button>
              <Button
                onClick={() => window.location.href = '/predictor'}
                variant="outline"
                size="sm"
                className="border-white/20 text-white hover:bg-white/10 text-xs"
                data-testid="phase-predictor-button"
              >
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Predictor
              </Button>
            </div>

            {/* Divider */}
            <div className="border-t border-white/10 mb-4" />

            {/* Today's Game Plan */}
            <div className="mb-4">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">Today&apos;s Game Plan</div>
              <div className="space-y-2">
                {/* Play-by-Play (pulse icon) */}
                <div className="flex gap-2 items-start text-sm text-slate-200" data-testid="brief-play-by-play">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span>{cycleInfo.briefPlayByPlay}</span>
                </div>
                {/* Feelings (heart icon) */}
                <div className="flex gap-2 items-start text-sm text-slate-200" data-testid="brief-feelings">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  <span>{cycleInfo.briefFeelings}</span>
                </div>
                {/* Prep (clipboard icon) */}
                <div className="flex gap-2 items-start text-sm text-slate-200" data-testid="brief-prep">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  <span>{dateSeedPick(cycleInfo.prep, 'prep')}</span>
                </div>
                {/* Action (lightning bolt icon) */}
                <div className="flex gap-2 items-start text-sm text-slate-200" data-testid="brief-action">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                  <span>{dateSeedPick(cycleInfo.action, 'action')}</span>
                </div>
              </div>
            </div>

            {/* Bottom button row: See Full Details + AI Tips side by side */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => setShowPhaseDetail(true)}
                variant="outline"
                size="sm"
                className="border-white/20 text-white hover:bg-white/10 text-xs"
                data-testid="see-full-details-btn"
              >
                See Full Details
              </Button>
              {hasAIAccess && planType !== 'basic' ? (
                personalizedTips.length > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs"
                    disabled
                  >
                    AI tips loaded
                  </Button>
                ) : !loadingPersonalizedTips ? (
                  <Button
                    onClick={fetchPersonalizedTips}
                    variant="outline"
                    size="sm"
                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs"
                    data-testid="load-personalized-tips"
                  >
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    AI-personalized tips
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="border-slate-600 text-slate-500 text-xs" disabled>
                    Generating...
                  </Button>
                )
              ) : (
                <Button
                  onClick={() => setShowUpgradeModal(true)}
                  variant="outline"
                  size="sm"
                  className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs"
                >
                  AI-personalized tips
                </Button>
              )}
            </div>

            {/* Personalized tips display (if loaded) */}
            {hasAIAccess && planType !== 'basic' && personalizedTips.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="text-xs text-emerald-400 font-semibold mb-2 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Personalized for You
                </div>
                <ul className="space-y-1.5">
                  {personalizedTips.map((tip, idx) => (
                    <li key={`p-${idx}`} className="flex gap-2 text-slate-200 text-sm" data-testid={`personalized-tip-${idx}`}>
                      <span className="text-emerald-400 flex-shrink-0">&bull;</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Phase Detail Dialog — shared modal component */}
        {cycleInfo?.fullContent && (
          <PhaseDetailModal
            open={showPhaseDetail}
            onOpenChange={setShowPhaseDetail}
            phase={cycleInfo.fullContent}
          />
        )}

        {/* Cycle History Dialog */}
        <CycleHistoryDialog
          open={showCycleHistory}
          onOpenChange={setShowCycleHistory}
          cycleHistory={cycleHistory}
          logPeriodDate={logPeriodDate}
          setLogPeriodDate={setLogPeriodDate}
          onLogPeriod={handleLogPeriod}
          onDeleteCycle={handleDeleteCycle}
        />

        {/* Research-Backed Fact Card */}
        {funFact && (
          <Card className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 backdrop-blur-sm border-cyan-500/30 mb-8" data-testid="fun-fact-card">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="text-4xl">🔬</div>
                <div className="flex-1">
                  <div className="text-cyan-400 font-semibold text-sm mb-2">
                    {funFact.phase ? `${funFact.phase} Phase • Research Insight` : 'Research Insight'}
                  </div>
                  <p className="text-white text-base leading-relaxed mb-3">{funFact.fact}</p>
                  {funFact.practical && (
                    <div className="bg-slate-800/50 rounded-lg p-3 mb-2">
                      <p className="text-cyan-300 text-sm">
                        <span className="font-semibold">💡 What this means for you:</span> {funFact.practical}
                      </p>
                    </div>
                  )}
                  {funFact.source && (
                    <p className="text-slate-500 text-xs italic">Source: {funFact.source}</p>
                  )}
                </div>
                <Button
                  onClick={loadFunFact}
                  variant="ghost"
                  size="sm"
                  className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                  data-testid="refresh-fun-fact-button"
                  title="Show another fact"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* MoodMap Section */}
        {cycleInfo && (
          <div className="mb-8">
            <MoodMap currentCycleDay={cycleInfo.cycle_day} cycleInfo={cycleInfo} />
          </div>
        )}

        {/* Tabs Section */}
        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700" tabIndex={-1}>
            {/* Resources tab archived — will revisit with manual library */}
            <TabsTrigger value="chat" data-testid="tab-ai-coach">
              AI Wingman
            </TabsTrigger>
            <TabsTrigger value="profile" data-testid="tab-partner-profile">
              Partner Profile
            </TabsTrigger>
            <TabsTrigger value="manual" data-testid="tab-coaching-manual">
              Coaching Manual
            </TabsTrigger>
          </TabsList>

          {/* AI Wingman Tab */}
          <TabsContent value="chat" data-testid="ai-coach-content">
            <AIWingmanTab
              hasAIAccess={hasAIAccess}
              chatHistory={chatHistory}
              chatMessage={chatMessage}
              setChatMessage={setChatMessage}
              onSendMessage={handleSendMessage}
              onUpgrade={handleUpgradeToAdvanced}
              upgrading={upgrading}
            />
          </TabsContent>

          {/* Partner Profile Tab */}
          <TabsContent value="profile" data-testid="partner-profile-content">
            <PartnerProfile
              partner={partner}
              updatePreference={updatePreference}
              hasAIAccess={hasAIAccess}
            />
          </TabsContent>

          {/* Coaching Manual Tab */}
          <TabsContent value="manual" data-testid="coaching-manual-content">
            <CoachingManual />
          </TabsContent>

          {/* === ARCHIVED: Resources Tab — code preserved in git history === */}
        </Tabs>
      </div>
      
      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        feedbackType={feedbackType}
        email={subscriptionTier?.email}
        subscriptionTier={subscriptionTier?.tier}
      />

      {/* Upgrade to Advanced Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        onUpgrade={handleUpgradeCheckout}
        upgrading={upgrading}
      />
    </div>
  );
};

export default Dashboard;

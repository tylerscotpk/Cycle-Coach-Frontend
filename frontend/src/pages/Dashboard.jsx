import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MoodMap from '@/components/MoodMap';
import FeedbackModal from '@/components/FeedbackModal';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

import { LocalStorage } from '../utils/localStorageManager';
import { calculateCycleDay, getPhaseInfo, recalculateCycleLengths, calculateStatistics, predictNextPeriod } from '../utils/cycleCalculations';
import { RESOURCES, getRelevantResources, getNextPhase } from '../utils/resourcesData';
import { getUnseenFact } from '../utils/cycleFacts';

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
  const [bookmarkedResources, setBookmarkedResources] = useState([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showCycleHistory, setShowCycleHistory] = useState(false);
  const [cycleHistory, setCycleHistory] = useState(null);
  const [logPeriodDate, setLogPeriodDate] = useState('');
  
  // Subscription tier state (for feedback prompts)
  const [subscriptionTier, setSubscriptionTier] = useState(null);
  
  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState(null);

  // Setup form
  const [partnerName, setPartnerName] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState('');

  // Helper to render text with bold markdown
  const renderTipWithBold = (tip) => {
    const parts = tip.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  useEffect(() => {
    loadData();
    checkForFeedbackPrompt();
  }, []);
  
  // Check if we should show a feedback prompt
  const checkForFeedbackPrompt = async () => {
    const tier = LocalStorage.getSubscriptionTier();
    if (!tier?.email) return;
    
    try {
      const response = await fetch(`${API}/feedback/check/${encodeURIComponent(tier.email)}`);
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
      // Load subscription tier info
      const tierData = LocalStorage.getSubscriptionTier();
      if (tierData) {
        setSubscriptionTier(tierData);
      }
      
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
      const cycleDay = calculateCycleDay(profile.cycleStartDate, profile.cycleLength || 28);
      const phaseInfo = getPhaseInfo(cycleDay);
      const nextPhase = getNextPhase(phaseInfo.phase);
      
      const relevantResources = getRelevantResources(phaseInfo.phase, nextPhase);
      
      // Combine current phase resources + some upcoming + general
      const allResources = [
        ...relevantResources.current,
        ...relevantResources.upcoming.slice(0, 2),
        ...relevantResources.general.slice(0, 2)
      ];
      
      // Shuffle slightly for variety but keep phase-matched at top
      const phaseMatched = allResources.filter(r => r.is_phase_match);
      const others = allResources.filter(r => !r.is_phase_match);
      
      setCurrentResources([...phaseMatched, ...others].slice(0, 6));
    } catch (error) {
      console.error('Error loading resources:', error);
      // Fallback to general resources
      setCurrentResources(RESOURCES.filter(r => r.phase === 'General').slice(0, 3));
    }
  };

  const loadCycleInfoLocal = (profile) => {
    try {
      console.log('Loading cycle info from profile:', profile);
      console.log('Cycle start date:', profile.cycleStartDate);
      
      const cycleDay = calculateCycleDay(profile.cycleStartDate, profile.cycleLength || 28);
      console.log('Calculated cycle day:', cycleDay);
      
      const phaseInfo = getPhaseInfo(cycleDay);
      setCycleInfo({
        cycle_day: cycleDay,
        phase: phaseInfo.phase,
        phase_number: phaseInfo.phase_number,
        phase_day: phaseInfo.phase_day,
        description: phaseInfo.description,
        tips: phaseInfo.tips
      });
      
      // Set a research-backed fun fact for the current phase
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
      // ANONYMOUS CHAT: No user ID, ephemeral only
      const response = await axios.post(
        `${API}/chat/anonymous`,
        {
          message: userMsg,
          cycle_day: cycleInfo?.cycle_day,
          phase: cycleInfo?.phase
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
    if (!partner) return;
    
    try {
      // LOCAL-ONLY: Archive by removing from current resources
      setCurrentResources(prev => prev.filter(r => r.id !== resourceId));
      toast.success('Resource archived!');
      
      // If we're running low on resources, load more
      if (currentResources.length <= 2) {
        loadMoreResources();
      }
    } catch (error) {
      console.error('Error archiving resource:', error);
      toast.error('Failed to archive');
    }
  };

  const handleBookmarkResource = (resourceId) => {
    if (!partner) return;
    
    try {
      const bookmarkedResource = currentResources.find(r => r.id === resourceId);
      if (bookmarkedResource) {
        // Check if already bookmarked
        if (!bookmarkedResources.find(r => r.id === resourceId)) {
          setBookmarkedResources(prev => [...prev, bookmarkedResource]);
          toast.success('Resource bookmarked!');
        } else {
          toast.info('Already bookmarked!');
        }
      }
      // Remove from current resources
      setCurrentResources(prev => prev.filter(r => r.id !== resourceId));
      
      // If we're running low on resources, load more
      if (currentResources.length <= 2) {
        loadMoreResources();
      }
    } catch (error) {
      console.error('Error bookmarking resource:', error);
      toast.error('Failed to bookmark');
    }
  };

  const loadMoreResources = () => {
    if (!cycleInfo) return;
    
    try {
      const nextPhase = getNextPhase(cycleInfo.phase);
      const relevantResources = getRelevantResources(cycleInfo.phase, nextPhase);
      
      // Get IDs of resources already shown or bookmarked
      const usedIds = new Set([
        ...currentResources.map(r => r.id),
        ...bookmarkedResources.map(r => r.id)
      ]);
      
      // Find resources not yet shown
      const allAvailable = [
        ...relevantResources.current,
        ...relevantResources.upcoming,
        ...relevantResources.general
      ].filter(r => !usedIds.has(r.id));
      
      if (allAvailable.length > 0) {
        setCurrentResources(prev => [...prev, ...allAvailable.slice(0, 3)]);
      }
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
      loadCycleHistory();
      loadCycleInfoLocal(partner);
    } catch (error) {
      console.error('Error deleting cycle:', error);
      toast.error('Failed to delete');
    }
  };

  // Check if user has premium features
  const hasPremiumFeatures = () => {
    if (!subscriptionTier) return false;
    return subscriptionTier.has_partner_profile === true && subscriptionTier.has_ai_wingman === true;
  };

  // All plans now include full features
  const hasPartnerProfile = () => true;
  const hasAIWingman = () => true;

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
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">Loading dashboard...</div>
      </div>
    );
  }

  // If no partner profile, show setup
  if (!partner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-12">
            <h1 className="text-3xl font-bold text-white">Cycle Coach</h1>
            <Button
              onClick={() => window.location.href = '/privacy'}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              🔒 Privacy & Data
            </Button>
          </div>

          {/* Setup Form */}
          <div className="max-w-2xl mx-auto">
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700" data-testid="setup-partner-card">
              <CardHeader>
                <CardTitle className="text-2xl text-white">Alright, Let's Set This Up</CardTitle>
                <CardDescription className="text-slate-400">Tell us about your girl so we can help you not screw this up</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreatePartner} className="space-y-6">
                  <div>
                    <Label htmlFor="partner-name" className="text-white">Her Name</Label>
                    <Input
                      id="partner-name"
                      data-testid="partner-name-input"
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      placeholder="What do you call her?"
                      required
                      className="bg-slate-700/50 border-slate-600 text-white mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cycle-date" className="text-white">First Day of Her Last Period</Label>
                    <Input
                      id="cycle-date"
                      data-testid="cycle-start-date-input"
                      type="date"
                      value={cycleStartDate}
                      onChange={(e) => setCycleStartDate(e.target.value)}
                      required
                      className="bg-slate-700/50 border-slate-600 text-white mt-2"
                    />
                  </div>

                  <Button
                    type="submit"
                    data-testid="create-partner-button"
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                  >
                    Create Profile
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-6 py-8 pb-20">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white" data-testid="dashboard-title">Cycle Coach</h1>
            {partner && <p className="text-slate-400 mt-1">Tracking {partner.partnerName}'s cycle</p>}
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => window.location.href = '/privacy'}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              🔒 Privacy & Data
            </Button>
          </div>
        </div>

        {/* Current Cycle Info */}
        {cycleInfo && (
          <div className={`bg-gradient-to-r ${getPhaseColor(cycleInfo.phase)} backdrop-blur-sm p-8 rounded-2xl border mb-8`} data-testid="cycle-info-card">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <div className="text-sm text-slate-400 mb-2">Current Phase</div>
                <div className="text-4xl font-bold text-white mb-4" data-testid="current-phase">{cycleInfo.phase}</div>
                <div className="text-slate-300 mb-4">{cycleInfo.description}</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-400">Overall Cycle</div>
                    <div className="text-2xl font-bold text-white" data-testid="cycle-day">Day {cycleInfo.cycle_day}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Phase Progress</div>
                    <div className="text-2xl font-bold text-white" data-testid="phase-day">
                      Phase {cycleInfo.phase_number}: Day {cycleInfo.phase_day}
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 space-y-2">
                  <Button
                    onClick={() => {
                      setShowCycleHistory(!showCycleHistory);
                      if (!cycleHistory) loadCycleHistory();
                    }}
                    variant="outline"
                    size="sm"
                    className="border-white/30 text-white hover:bg-white/10"
                    data-testid="toggle-cycle-history-button"
                  >
                    📊 Cycle History & Stats
                  </Button>
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-400 mb-3">Today's Tips</div>
                <ul className="space-y-2">
                  {cycleInfo.tips.slice(0, 4).map((tip, idx) => (
                    <li key={idx} className="flex gap-2 text-slate-200" data-testid={`tip-${idx}`}>
                      <span className="text-cyan-400">•</span>
                      <span>{renderTipWithBold(tip)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>
        )}

        {/* Cycle History Dialog */}
        <Dialog open={showCycleHistory} onOpenChange={setShowCycleHistory}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Cycle History & Statistics</DialogTitle>
            </DialogHeader>
            
            {cycleHistory && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="bg-white/10 border-white/20">
                    <CardContent className="p-4">
                      <div className="text-xs text-slate-300 mb-1">Average Cycle</div>
                      <div className="text-2xl font-bold text-white">{cycleHistory.statistics.average_length} days</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/10 border-white/20">
                    <CardContent className="p-4">
                      <div className="text-xs text-slate-300 mb-1">Range</div>
                      <div className="text-2xl font-bold text-white">{cycleHistory.statistics.min_length}-{cycleHistory.statistics.max_length} days</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/10 border-white/20">
                    <CardContent className="p-4">
                      <div className="text-xs text-slate-300 mb-1">Next Period</div>
                      <div className="text-2xl font-bold text-white">~{cycleHistory.prediction.days_until_next} days</div>
                    </CardContent>
                  </Card>
                </div>

                {cycleHistory.statistics.is_irregular && (
                  <div className="bg-orange-500/20 border border-orange-500/30 p-3 rounded-lg">
                    <p className="text-orange-200 text-sm">
                      ⚠️ <strong>Irregular Cycle Detected:</strong> {cycleHistory.statistics.variability} day variation. Keep logging periods for better predictions!
                    </p>
                  </div>
                )}

                <div className="bg-white/10 p-4 rounded-lg">
                  <h4 className="text-white font-semibold mb-3">Log New Period</h4>
                  <form onSubmit={handleLogPeriod} className="flex gap-2">
                    <Input
                      type="date"
                      value={logPeriodDate}
                      onChange={(e) => setLogPeriodDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      required
                      className="bg-white/20 border-white/30 text-white"
                      data-testid="log-period-date-input"
                    />
                    <Button
                      type="submit"
                      className="bg-white text-slate-900 hover:bg-white/90"
                      data-testid="log-period-button"
                    >
                      Log Period
                    </Button>
                  </form>
                </div>

                <div className="space-y-2">
                  <h4 className="text-white font-semibold mb-2">Recent Cycles</h4>
                  {cycleHistory.history.slice(0, 8).map((cycle, idx) => {
                    const isCurrent = cycle.status === 'current' && idx === 0; // Only first entry can be current
                    
                    // Format date without timezone conversion
                    const formatDate = (dateStr) => {
                      try {
                        const parts = dateStr.match(/(\d{4})-(\d{2})-(\d{2})|(\d{2})\/(\d{2})\/(\d{4})|(\d{2})-(\d{2})-(\d{4})/);
                        if (!parts) return dateStr;
                        
                        let year, month, day;
                        if (parts[1]) { // YYYY-MM-DD
                          [, year, month, day] = parts;
                        } else if (parts[4]) { // MM/DD/YYYY
                          [, , , , month, day, year] = parts;
                        } else { // MM-DD-YYYY
                          [, , , , , , , month, day, year] = parts;
                        }
                        
                        return new Date(year, month - 1, day).toLocaleDateString();
                      } catch {
                        return dateStr;
                      }
                    };
                    
                    return (
                      <div key={idx} className="flex justify-between items-center bg-white/10 p-3 rounded" data-testid={`cycle-history-${idx}`}>
                        <span className="text-slate-200">{formatDate(cycle.cycle_start_date)}</span>
                        <div className="flex items-center gap-3">
                          {isCurrent ? (
                            <span className="text-cyan-400 font-medium">Current</span>
                          ) : cycle.cycle_length && cycle.cycle_length > 0 ? (
                            <span className="text-slate-300">{cycle.cycle_length} days</span>
                          ) : (
                            <span className="text-slate-400 italic">Calculating...</span>
                          )}
                          <Button
                            onClick={() => handleDeleteCycle(cycle.id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-8 w-8 p-0 flex-shrink-0"
                            data-testid={`delete-cycle-${idx}`}
                            title={isCurrent ? "Delete current cycle" : "Delete cycle"}
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* MoodMap Section */}
        {cycleInfo && (
          <div className="mb-8">
            <MoodMap currentCycleDay={cycleInfo.cycle_day} cycleInfo={cycleInfo} />
          </div>
        )}

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

        {/* Upgrade Banner for non-premium users */}
        {!hasPremiumFeatures() && (
          <UpgradeBanner 
            tierName={getTierDisplayName()} 
            onUpgrade={handleUpgradeToElite} 
            isUpgrading={isUpgrading} 
          />
        )}

        {/* Tabs Section */}
        <Tabs defaultValue="resources" className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700" tabIndex={-1}>
            <TabsTrigger value="resources" data-testid="tab-resources">Resources</TabsTrigger>
            <TabsTrigger value="chat" data-testid="tab-ai-coach" className="relative">
              AI Wingman
              {!hasAIWingman() && <span className="ml-1 text-purple-400 text-xs">⭐</span>}
            </TabsTrigger>
            <TabsTrigger value="profile" data-testid="tab-partner-profile" className="relative">
              Partner Profile
              {!hasPartnerProfile() && <span className="ml-1 text-purple-400 text-xs">⭐</span>}
            </TabsTrigger>
          </TabsList>

          {/* AI Wingman Tab */}
          <TabsContent value="chat" data-testid="ai-coach-content">
            {hasAIWingman() ? (
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Your AI Wingman</CardTitle>
                  <CardDescription className="text-slate-400">Ask questions, get real advice, learn what actually works</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96 mb-4 p-4 bg-slate-900/50 rounded-lg" data-testid="chat-history">
                    {chatHistory.length === 0 ? (
                      <div className="text-slate-400 text-center py-8" data-testid="empty-chat-message">
                        What's up? Ask me anything about your girl. "What should I do when she's mad?" "How does she like her coffee?" I got you.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {chatHistory.map((conv, idx) => {
                          // Split response into main content and question
                          const parts = conv.response.split(/Question:/i);
                          const mainResponse = parts[0].trim();
                          const question = parts[1]?.trim();
                          
                          return (
                            <div key={idx} className="space-y-2">
                              <div className="bg-cyan-500/20 p-3 rounded-lg ml-8" data-testid={`user-message-${idx}`}>
                                <div className="text-xs text-cyan-400 mb-1">You</div>
                                <div className="text-white">{conv.message}</div>
                              </div>
                              <div className="bg-slate-700/50 p-3 rounded-lg mr-8" data-testid={`ai-response-${idx}`}>
                                <div className="text-xs text-cyan-400 mb-1">AI Wingman</div>
                                <div className="text-slate-200 whitespace-pre-line">{mainResponse}</div>
                              </div>
                              {question && (
                                <div className="bg-cyan-500/10 border border-cyan-500/30 p-3 rounded-lg mr-8" data-testid={`ai-question-${idx}`}>
                                  <div className="text-xs text-cyan-400 mb-1">💬 Follow-up Question</div>
                                  <div className="text-cyan-300 font-medium">{question}</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>

                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      data-testid="chat-input"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="e.g., 'She's been quiet all day, what do I do?'"
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                    <Button type="submit" data-testid="send-message-button" className="bg-cyan-500 hover:bg-cyan-600">
                      Send
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <UpgradePrompt feature="AI Wingman" onUpgrade={handleUpgradeToElite} isUpgrading={isUpgrading} />
            )}
          </TabsContent>

          {/* Partner Profile Tab */}
          <TabsContent value="profile" data-testid="partner-profile-content">
            {hasPartnerProfile() ? (
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Partner Profile</CardTitle>
                  <CardDescription className="text-slate-400">
                    Track her preferences so you never forget what she likes
                  </CardDescription>
                </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left Column - Preferences */}
                  <div className="space-y-4">
                    <h3 className="text-white font-semibold text-lg mb-3">Preferences</h3>
                    <div>
                      <Label htmlFor="coffee-order" className="text-white">Coffee Order</Label>
                      <Input
                        id="coffee-order"
                        data-testid="coffee-order-input"
                        placeholder="e.g., Iced oat milk latte, extra shot"
                        defaultValue={partner.preferences?.coffee_order || ''}
                        onBlur={(e) => updatePreference('coffee_order', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="ice-cream" className="text-white">Favorite Ice Cream</Label>
                      <Input
                        id="ice-cream"
                        data-testid="ice-cream-input"
                        placeholder="e.g., Mint chocolate chip"
                        defaultValue={partner.preferences?.ice_cream || ''}
                        onBlur={(e) => updatePreference('ice_cream', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="comfort-food" className="text-white">Comfort Food</Label>
                      <Input
                        id="comfort-food"
                        data-testid="comfort-food-input"
                        placeholder="e.g., Pizza, Mac & cheese, Sushi"
                        defaultValue={partner.preferences?.comfort_food || ''}
                        onBlur={(e) => updatePreference('comfort_food', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="love-language" className="text-white">Love Language</Label>
                      <Input
                        id="love-language"
                        data-testid="love-language-input"
                        placeholder="e.g., Quality time, Acts of service"
                        defaultValue={partner.preferences?.love_language || ''}
                        onBlur={(e) => updatePreference('love_language', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="stressed-preference" className="text-white">When Stressed, She Wants</Label>
                      <Input
                        id="stressed-preference"
                        data-testid="stressed-preference-input"
                        placeholder="e.g., Space to decompress, Cuddles and talk"
                        defaultValue={partner.preferences?.stressed_preference || ''}
                        onBlur={(e) => updatePreference('stressed_preference', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="gift-ideas" className="text-white">Gift Ideas</Label>
                      <Input
                        id="gift-ideas"
                        data-testid="gift-ideas-input"
                        placeholder="e.g., Books, Candles, Jewelry"
                        defaultValue={partner.preferences?.gift_ideas || ''}
                        onBlur={(e) => updatePreference('gift_ideas', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="date-ideas" className="text-white">Favorite Date Ideas</Label>
                      <Input
                        id="date-ideas"
                        data-testid="date-ideas-input"
                        placeholder="e.g., Hiking, Cooking together, Wine tasting"
                        defaultValue={partner.preferences?.date_ideas || ''}
                        onBlur={(e) => updatePreference('date_ideas', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white mt-2"
                      />
                    </div>
                  </div>

                  {/* Right Column - Entertainment */}
                  <div className="space-y-4">
                    <h3 className="text-white font-semibold text-lg mb-3">Entertainment</h3>
                    <div>
                      <Label htmlFor="movie-genre" className="text-white">Movie Genres</Label>
                      <Input
                        id="movie-genre"
                        data-testid="movie-genre-input"
                        placeholder="e.g., Rom-coms, Horror, Drama"
                        defaultValue={partner.preferences?.movie_genre || ''}
                        onBlur={(e) => updatePreference('movie_genre', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="favorite-movies" className="text-white">Favorite Movies</Label>
                      <Input
                        id="favorite-movies"
                        data-testid="favorite-movies-input"
                        placeholder="e.g., The Notebook, Inception, The Shawshank Redemption"
                        defaultValue={partner.preferences?.favorite_movies || ''}
                        onBlur={(e) => updatePreference('favorite_movies', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="tv-series" className="text-white">Favorite TV Series</Label>
                      <Input
                        id="tv-series"
                        data-testid="tv-series-input"
                        placeholder="e.g., Friends, Stranger Things, The Office"
                        defaultValue={partner.preferences?.tv_series || ''}
                        onBlur={(e) => updatePreference('tv_series', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="music-artists" className="text-white">Favorite Music Artists</Label>
                      <Input
                        id="music-artists"
                        data-testid="music-artists-input"
                        placeholder="e.g., Taylor Swift, The Weeknd, Billie Eilish"
                        defaultValue={partner.preferences?.music_artists || ''}
                        onBlur={(e) => updatePreference('music_artists', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="music-genres" className="text-white">Music Genres</Label>
                      <Input
                        id="music-genres"
                        data-testid="music-genres-input"
                        placeholder="e.g., Pop, R&B, Indie, Country"
                        defaultValue={partner.preferences?.music_genres || ''}
                        onBlur={(e) => updatePreference('music_genres', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="podcast-shows" className="text-white">Podcasts She Listens To</Label>
                      <Input
                        id="podcast-shows"
                        data-testid="podcast-shows-input"
                        placeholder="e.g., Crime Junkie, The Daily, Call Her Daddy"
                        defaultValue={partner.preferences?.podcast_shows || ''}
                        onBlur={(e) => updatePreference('podcast_shows', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white mt-2"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <p className="text-cyan-400 text-sm">
                    💡 <strong>Pro Tip:</strong> The AI Wingman uses this info to give you personalized recommendations. 
                    Ask things like "What movie should we watch tonight?" or "Any new albums she'd like?"
                  </p>
                </div>
              </CardContent>
            </Card>
            ) : (
              <UpgradePrompt feature="Partner Profile" onUpgrade={handleUpgradeToElite} isUpgrading={isUpgrading} />
            )}
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" data-testid="resources-content">
            <div className="flex justify-end mb-4">
              <Button
                onClick={() => setShowBookmarks(!showBookmarks)}
                variant="outline"
                className="border-slate-600 text-slate-300"
                data-testid="toggle-bookmarks-button"
              >
                {showBookmarks ? 'Show Current' : `Bookmarks (${bookmarkedResources.length})`}
              </Button>
            </div>

            {!showBookmarks && currentResources.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentResources.map((resource, idx) => (
                  <Card key={resource.id} className="bg-slate-800/50 backdrop-blur-sm border-slate-700 hover:border-cyan-500/50 transition-all flex flex-col" data-testid={`current-resource-${idx}`}>
                    {resource.thumbnail && (
                      <div className="h-48 overflow-hidden rounded-t-lg">
                        <img src={resource.thumbnail} alt={resource.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardHeader className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="text-xs text-cyan-400 uppercase px-3 py-1 bg-cyan-500/20 rounded-full">
                          {resource.type}
                        </div>
                        {resource.is_phase_match && (
                          <div className="text-xs text-white px-3 py-1 bg-cyan-500 rounded-full">
                            🎯 For Today
                          </div>
                        )}
                        {resource.is_upcoming && (
                          <div className="text-xs text-orange-400 px-3 py-1 bg-orange-500/20 rounded-full">
                            ⏭️ Coming Up: {resource.upcoming_phase}
                          </div>
                        )}
                        {!resource.is_phase_match && !resource.is_upcoming && resource.phase && (
                          <div className="text-xs text-slate-400 px-3 py-1 bg-slate-700/50 rounded-full">
                            {resource.phase}
                          </div>
                        )}
                      </div>
                      <CardTitle className="text-white text-lg">{resource.title}</CardTitle>
                      <CardDescription className="text-slate-400">{resource.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        asChild
                        className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                        data-testid={`view-resource-${idx}`}
                      >
                        <a href={resource.url} target="_blank" rel="noopener noreferrer">
                          Read/Watch
                        </a>
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleBookmarkResource(resource.id)}
                          variant="outline"
                          size="sm"
                          className="flex-1 border-slate-600 text-slate-300 hover:bg-cyan-500/20 hover:border-cyan-500"
                          data-testid={`bookmark-${idx}`}
                        >
                          📌
                        </Button>
                        <Button
                          onClick={() => handleArchiveResource(resource.id)}
                          variant="outline"
                          size="sm"
                          className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                          data-testid={`archive-${idx}`}
                        >
                          ✓ Done
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !showBookmarks ? (
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
                <CardContent className="p-12 text-center">
                  <div className="text-6xl mb-4">🎉</div>
                  <h3 className="text-2xl font-bold text-white mb-3">All Caught Up!</h3>
                  <p className="text-slate-400">You've viewed all available resources. Check back later for more!</p>
                </CardContent>
              </Card>
            ) : null}

            {showBookmarks && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bookmarkedResources.length === 0 ? (
                  <div className="col-span-full text-center text-slate-400 py-12" data-testid="no-bookmarks-message">
                    No bookmarked resources yet. Bookmark resources you want to come back to!
                  </div>
                ) : (
                  bookmarkedResources.map((resource, idx) => (
                    <Card key={resource.id} className="bg-slate-800/50 backdrop-blur-sm border-slate-700 hover:border-cyan-500/50 transition-all" data-testid={`bookmarked-resource-${idx}`}>
                      {resource.thumbnail && (
                        <div className="h-48 overflow-hidden rounded-t-lg">
                          <img src={resource.thumbnail} alt={resource.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <CardHeader>
                        <div className="text-xs text-cyan-400 uppercase mb-2">{resource.type}</div>
                        <CardTitle className="text-white text-lg">{resource.title}</CardTitle>
                        <CardDescription className="text-slate-400">{resource.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button
                          data-testid={`bookmarked-resource-link-${idx}`}
                          asChild
                          variant="outline"
                          className="w-full border-slate-600 text-slate-300 hover:bg-cyan-500/20 hover:border-cyan-500"
                        >
                          <a href={resource.url} target="_blank" rel="noopener noreferrer">
                            View Resource
                          </a>
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </TabsContent>
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
    </div>
  );
};

export default Dashboard;

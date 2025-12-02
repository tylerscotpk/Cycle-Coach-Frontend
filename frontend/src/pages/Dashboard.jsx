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
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = ({ user, setUser }) => {
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
  }, []);

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

  // Force scroll when data loads
  useEffect(() => {
    if (partner && cycleInfo) {
      setTimeout(() => window.scrollTo(0, 0), 0);
    }
  }, [partner, cycleInfo]);

  const loadData = async () => {
    try {
      // Check if partner profile exists
      try {
        const partnerRes = await axios.get(`${API}/partner`, { withCredentials: true });
        setPartner(partnerRes.data);
        await loadCycleInfo(partnerRes.data.id);
        await loadChatHistory(partnerRes.data.id);
        await loadFunFact(partnerRes.data.id);
      } catch (err) {
        console.log('No partner profile yet');
      }

      // Load resources
      try {
        const nextResources = await axios.get(`${API}/resources/next?partner_id=${partnerRes.data.id}&limit=3`, { withCredentials: true });
        setCurrentResources(nextResources.data || []);
      } catch (err) {
        console.log('No more unread resources');
      }
      
      const bookmarked = await axios.get(`${API}/resources/bookmarked`, { withCredentials: true });
      setBookmarkedResources(bookmarked.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFunFact = async (partnerId) => {
    try {
      const response = await axios.get(`${API}/fun-fact?partner_id=${partnerId}`, { withCredentials: true });
      setFunFact(response.data);
    } catch (error) {
      console.error('Error loading fun fact:', error);
    }
  };

  const loadCycleInfo = async (partnerId) => {
    try {
      const response = await axios.get(`${API}/cycle/current?partner_id=${partnerId}`, { withCredentials: true });
      setCycleInfo(response.data);
    } catch (error) {
      console.error('Error loading cycle info:', error);
    }
  };

  const loadChatHistory = async (partnerId) => {
    try {
      const response = await axios.get(`${API}/chat/history?partner_id=${partnerId}`, { withCredentials: true });
      setChatHistory(response.data.reverse());
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleCreatePartner = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        `${API}/partner`,
        {
          partner_name: partnerName,
          cycle_start_date: cycleStartDate,
          cycle_length: 28
        },
        { withCredentials: true }
      );
      setPartner(response.data);
      await loadCycleInfo(response.data.id);
      toast.success('Partner profile created!');
    } catch (error) {
      console.error('Error creating partner:', error);
      toast.error('Failed to create partner profile');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || !partner) return;

    const userMsg = chatMessage;
    setChatMessage('');

    // Add user message to history immediately
    setChatHistory(prev => [...prev, { message: userMsg, response: '...' }]);

    try {
      const response = await axios.post(
        `${API}/chat`,
        {
          message: userMsg,
          partner_id: partner.id
        },
        { withCredentials: true }
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

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updatePreference = async (key, value) => {
    if (!value.trim() || !partner) return;
    
    try {
      await axios.post(
        `${API}/preferences`,
        { key, value },
        { 
          params: { partner_id: partner.id },
          withCredentials: true 
        }
      );
      
      // Update local partner state
      setPartner(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [key]: value
        }
      }));
      
      toast.success('Preference saved!');
    } catch (error) {
      console.error('Error saving preference:', error);
      toast.error('Failed to save preference');
    }
  };

  const handleArchiveResource = async (resourceId) => {
    if (!partner) return;
    
    try {
      await axios.post(`${API}/resources/${resourceId}/archive`, {}, { withCredentials: true });
      toast.success('Resource archived!');
      // Remove from current resources
      setCurrentResources(prev => prev.filter(r => r.id !== resourceId));
      // Load more if needed
      if (currentResources.length <= 1) {
        await loadNextResources();
      }
    } catch (error) {
      console.error('Error archiving resource:', error);
      toast.error('Failed to archive');
    }
  };

  const handleBookmarkResource = async (resourceId) => {
    if (!partner) return;
    
    try {
      await axios.post(`${API}/resources/${resourceId}/bookmark`, {}, { withCredentials: true });
      toast.success('Resource bookmarked!');
      const bookmarkedResource = currentResources.find(r => r.id === resourceId);
      if (bookmarkedResource) {
        setBookmarkedResources(prev => [...prev, bookmarkedResource]);
      }
      // Remove from current resources
      setCurrentResources(prev => prev.filter(r => r.id !== resourceId));
      // Load more if needed
      if (currentResources.length <= 1) {
        await loadNextResources();
      }
    } catch (error) {
      console.error('Error bookmarking resource:', error);
      toast.error('Failed to bookmark');
    }
  };

  const loadNextResources = async () => {
    try {
      const response = await axios.get(`${API}/resources/next?partner_id=${partner.id}&limit=3`, { withCredentials: true });
      setCurrentResources(response.data || []);
    } catch (error) {
      console.error('Error loading next resources:', error);
      setCurrentResources([]);
    }
  };

  const handleLogPeriod = async (e) => {
    e.preventDefault();
    if (!logPeriodDate || !partner) return;
    
    try {
      console.log('Logging period with date:', logPeriodDate);
      const response = await axios.post(
        `${API}/cycle/log-period`,
        null,
        {
          params: {
            partner_id: partner.id,
            start_date: logPeriodDate
          },
          withCredentials: true
        }
      );
      
      console.log('Period logged, response:', response.data);
      toast.success(`Period logged! Previous cycle: ${response.data.previous_cycle_length} days`);
      setLogPeriodDate('');
      setShowCycleHistory(false);
      
      // Reload cycle info
      await loadCycleInfo(partner.id);
      await loadCycleHistory();
    } catch (error) {
      console.error('Error logging period:', error);
      toast.error('Failed to log period');
    }
  };

  const loadCycleHistory = async () => {
    try {
      const response = await axios.get(`${API}/cycle/history?partner_id=${partner.id}`, { withCredentials: true });
      setCycleHistory(response.data);
    } catch (error) {
      console.error('Error loading cycle history:', error);
    }
  };

  const handleDeleteCycle = async (cycleId) => {
    if (!confirm('Delete this cycle entry? This will recalculate your cycle statistics.')) return;
    
    try {
      console.log('Deleting cycle:', cycleId, 'for partner:', partner.id);
      
      // Optimistically remove from UI
      setCycleHistory(prev => ({
        ...prev,
        history: prev.history.filter(c => c.id !== cycleId)
      }));
      
      const response = await axios.delete(`${API}/cycle/history/${cycleId}`, {
        params: { partner_id: partner.id },
        withCredentials: true
      });
      console.log('Delete response:', response.data);
      toast.success('Cycle entry deleted');
      
      // Reload fresh data
      await loadCycleHistory();
      await loadCycleInfo(partner.id);
    } catch (error) {
      console.error('Error deleting cycle:', error);
      toast.error(`Failed to delete: ${error.response?.data?.detail || error.message}`);
      // Reload to restore correct state
      await loadCycleHistory();
    }
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
            <h1 className="text-3xl font-bold text-white">Do Her Better</h1>
            <Button onClick={handleLogout} variant="outline" className="border-slate-600 text-slate-300" data-testid="logout-button">
              Logout
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
            <h1 className="text-3xl font-bold text-white" data-testid="dashboard-title">Do Her Better</h1>
            <p className="text-slate-400 mt-1">Tracking {partner.partner_name}'s cycle</p>
          </div>
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarImage src={user.picture} />
              <AvatarFallback className="bg-cyan-500 text-white">{user.name[0]}</AvatarFallback>
            </Avatar>
            <Button onClick={handleLogout} variant="outline" className="border-slate-600 text-slate-300" data-testid="logout-button">
              Logout
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
                    const showDelete = !isCurrent; // Allow delete for all except true current
                    
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
                          {showDelete && (
                            <Button
                              onClick={() => handleDeleteCycle(cycle.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-8 w-8 p-0 flex-shrink-0"
                              data-testid={`delete-cycle-${idx}`}
                            >
                              ×
                            </Button>
                          )}
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

        {/* Fun Fact Card */}
        {funFact && (
          <Card className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 backdrop-blur-sm border-cyan-500/30 mb-8" data-testid="fun-fact-card">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="text-4xl">💡</div>
                <div className="flex-1">
                  <div className="text-cyan-400 font-semibold text-sm mb-2">
                    {funFact.phase ? `${funFact.phase} Phase Fun Fact` : 'Did You Know?'}
                  </div>
                  <p className="text-white text-lg leading-relaxed">{funFact.fact}</p>
                </div>
                <Button
                  onClick={() => loadFunFact(partner.id)}
                  variant="ghost"
                  size="sm"
                  className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                  data-testid="refresh-fun-fact-button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs Section */}
        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700" tabIndex={-1}>
            <TabsTrigger value="chat" data-testid="tab-ai-coach">AI Wingman</TabsTrigger>
            <TabsTrigger value="profile" data-testid="tab-partner-profile">Partner Profile</TabsTrigger>
            <TabsTrigger value="resources" data-testid="tab-resources">Resources</TabsTrigger>
          </TabsList>

          {/* AI Wingman Tab */}
          <TabsContent value="chat" data-testid="ai-coach-content">
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
          </TabsContent>

          {/* Partner Profile Tab */}
          <TabsContent value="profile" data-testid="partner-profile-content">
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
    </div>
  );
};

export default Dashboard;

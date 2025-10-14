import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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

  // Setup form
  const [partnerName, setPartnerName] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Check if partner profile exists
      try {
        const partnerRes = await axios.get(`${API}/partner`, { withCredentials: true });
        setPartner(partnerRes.data);
        await loadCycleInfo(partnerRes.data.id);
        await loadChatHistory(partnerRes.data.id);
      } catch (err) {
        console.log('No partner profile yet');
      }

      // Load resources
      const resourcesRes = await axios.get(`${API}/resources`, { withCredentials: true });
      setResources(resourcesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
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
      <div className="container mx-auto px-6 py-8">
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
                    <div className="text-xs text-slate-400">Cycle Day</div>
                    <div className="text-2xl font-bold text-white" data-testid="cycle-day">{cycleInfo.cycle_day}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Phase Day</div>
                    <div className="text-2xl font-bold text-white" data-testid="phase-day">{cycleInfo.phase_day}</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-400 mb-3">Today's Tips</div>
                <ul className="space-y-2">
                  {cycleInfo.tips.map((tip, idx) => (
                    <li key={idx} className="flex gap-2 text-slate-200" data-testid={`tip-${idx}`}>
                      <span className="text-cyan-400">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tabs Section */}
        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="chat" data-testid="tab-ai-coach">AI Coach</TabsTrigger>
            <TabsTrigger value="resources" data-testid="tab-resources">Resources</TabsTrigger>
          </TabsList>

          {/* AI Coach Tab */}
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
                      {chatHistory.map((conv, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="bg-cyan-500/20 p-3 rounded-lg ml-8" data-testid={`user-message-${idx}`}>
                            <div className="text-xs text-cyan-400 mb-1">You</div>
                            <div className="text-white">{conv.message}</div>
                          </div>
                          <div className="bg-slate-700/50 p-3 rounded-lg mr-8" data-testid={`ai-response-${idx}`}>
                            <div className="text-xs text-cyan-400 mb-1">AI Wingman</div>
                            <div className="text-slate-200">{conv.response}</div>
                          </div>
                        </div>
                      ))}
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

          {/* Resources Tab */}
          <TabsContent value="resources" data-testid="resources-content">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resources.length === 0 ? (
                <div className="col-span-full text-center text-slate-400 py-12" data-testid="no-resources-message">
                  No resources available yet. Check back soon!
                </div>
              ) : (
                resources.map((resource, idx) => (
                  <Card key={resource.id} className="bg-slate-800/50 backdrop-blur-sm border-slate-700 hover:border-cyan-500/50 transition-all" data-testid={`resource-${idx}`}>
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
                        data-testid={`resource-link-${idx}`}
                        asChild
                        variant="outline"
                        className="w-full border-slate-600 text-slate-300 hover:bg-cyan-500/20 hover:border-cyan-500"
                      >
                        <a href={resource.url} target="_blank" rel="noopener noreferrer">
                          Learn More
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;

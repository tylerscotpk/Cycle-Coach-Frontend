import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const AUTH_URL = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(`${window.location.origin}/dashboard`)}`;

const LandingPage = ({ setUser }) => {
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Check for session_id in URL fragment
    const hash = window.location.hash;
    if (hash.includes('session_id=')) {
      const sessionId = hash.split('session_id=')[1].split('&')[0];
      processSession(sessionId);
    }
  }, []);

  const processSession = async (sessionId) => {
    setProcessing(true);
    try {
      const response = await axios.post(
        `${API}/auth/process-session`,
        null,
        {
          params: { session_id: sessionId },
          withCredentials: true
        }
      );
      setUser(response.data.user);
      window.location.hash = ''; // Clear hash
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Auth error:', error);
      toast.error('Authentication failed. Please try again.');
      setProcessing(false);
    }
  };

  const handleLogin = () => {
    window.location.href = AUTH_URL;
  };

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">Authenticating...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 container mx-auto px-6 py-20">
        {/* Hero Section */}
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-block px-6 py-2 bg-cyan-500/20 backdrop-blur-sm rounded-full border border-cyan-500/30 mb-6">
            <span className="text-cyan-400 font-medium text-sm">Level Up Your Relationship Game</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight" data-testid="landing-main-heading">
            Do Her <span className="text-cyan-400">Better</span>
          </h1>

          <p className="text-xl sm:text-2xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Bros, we need to talk. Your girl's cycle is NOT a mystery. This is your cheat code to knowing EXACTLY when to bring flowers, when to shut up, and when she's DTF.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button
              data-testid="login-button"
              onClick={handleLogin}
              size="lg"
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/70"
            >
              Get Started - It's Free
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mt-32">
          <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-700/50 hover:border-cyan-500/50 transition-all" data-testid="feature-cycle-tracking">
            <div className="w-14 h-14 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Cycle Tracking</h3>
            <p className="text-slate-400">Know exactly where she is in her cycle. Basically like having ESPN for her emotions.</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-700/50 hover:border-cyan-500/50 transition-all" data-testid="feature-ai-insights">
            <div className="w-14 h-14 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">AI Wingman</h3>
            <p className="text-slate-400">Gets smarter the more you use it. Learns what she likes, remembers what works, and tells you exactly what to do.</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-700/50 hover:border-cyan-500/50 transition-all" data-testid="feature-daily-tips">
            <div className="w-14 h-14 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Daily Intel</h3>
            <p className="text-slate-400">Wake up to the game plan. What to say, what NOT to say, and when to strategically be "busy."</p>
          </div>
        </div>

        {/* How It Works */}
        <div className="max-w-4xl mx-auto mt-32">
          <h2 className="text-4xl font-bold text-white text-center mb-16">How It Works</h2>
          <div className="space-y-8">
            <div className="flex gap-6 items-start" data-testid="step-1">
              <div className="flex-shrink-0 w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-xl">1</div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Enter Her Cycle Start Date</h3>
                <p className="text-slate-400">First day of her last period. Yeah, you gotta ask. It's worth it, trust me.</p>
              </div>
            </div>

            <div className="flex gap-6 items-start" data-testid="step-2">
              <div className="flex-shrink-0 w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-xl">2</div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Let AI Learn Her Vibe</h3>
                <p className="text-slate-400">Tell it what she likes. Does she want space or cuddles? Sushi or pizza? The AI remembers so you don't have to.</p>
              </div>
            </div>

            <div className="flex gap-6 items-start" data-testid="step-3">
              <div className="flex-shrink-0 w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-xl">3</div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Get Daily Insights & Tips</h3>
                <p className="text-slate-400">Know when to plan date night, when to give space, and when to bring chocolate.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-3xl mx-auto mt-32 text-center bg-gradient-to-r from-cyan-500/20 to-blue-500/20 backdrop-blur-sm p-12 rounded-3xl border border-cyan-500/30">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Level Up?</h2>
          <p className="text-slate-300 mb-8 text-lg">Join thousands of guys who are already winning at relationships.</p>
          <Button
            data-testid="cta-get-started-button"
            onClick={handleLogin}
            size="lg"
            className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg shadow-cyan-500/50"
          >
            Get Started Now
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;

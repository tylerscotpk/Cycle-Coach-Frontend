import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const AUTH_BASE_URL = process.env.REACT_APP_AUTH_URL || 'https://auth.emergentagent.com';
const AUTH_URL = `${AUTH_BASE_URL}/?redirect=${encodeURIComponent(window.location.origin)}`;

const LandingPage = () => {
  const handleGetStarted = () => {
    // LOCAL-ONLY MODE: No authentication, go straight to app
    window.location.href = '/';
  };

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
            Cycle <span className="text-cyan-400">Coach</span>
          </h1>

          <p className="text-xl sm:text-2xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Bros, we need to talk. Your girl's cycle is NOT a mystery. This is your cheat code to knowing EXACTLY when to bring flowers, when to shut up, and when she's DTF.
          </p>

          {/* Privacy-First Badge */}
          <div className="flex justify-center gap-4 mb-8">
            <div className="bg-green-500/20 px-4 py-2 rounded-full border border-green-500/30">
              <span className="text-green-300 text-sm font-medium">🔒 100% Private - Data Stays on YOUR Device</span>
            </div>
            <div className="bg-cyan-500/20 px-4 py-2 rounded-full border border-cyan-500/30">
              <span className="text-cyan-300 text-sm font-medium">✨ No Account Needed</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button
              data-testid="get-started-button"
              onClick={handleGetStarted}
              size="lg"
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/70"
            >
              Start Using (No Login Required)
            </Button>
          </div>

          {/* CRITICAL Privacy Warning */}
          <div className="mt-16 max-w-4xl mx-auto bg-orange-500/10 backdrop-blur-sm border-2 border-orange-500/50 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-orange-300 mb-3">⚠️ IMPORTANT: Privacy & Consent</h3>
                <div className="space-y-3 text-slate-300 text-sm leading-relaxed">
                  <p className="font-semibold text-orange-200">
                    This app tracks sensitive reproductive health data. In many regions, this data can be legally subpoenaed and used against individuals.
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong className="text-white">Get Partner Consent:</strong> Your partner MUST consent to you tracking their cycle data. Tracking without consent is a violation of privacy and trust.</li>
                    <li><strong className="text-white">Privacy-First Design:</strong> All data is stored ONLY on your device. No servers, no accounts, no tracking. You have complete control.</li>
                    <li><strong className="text-white">No Identity Collection:</strong> We don't collect names, emails, or any personally identifiable information. The app works entirely in your browser.</li>
                    <li><strong className="text-white">AI Processing:</strong> If you use AI Wingman, messages are sent anonymously to OpenAI. Don't share identifying details in chat.</li>
                    <li><strong className="text-white">Legal Note:</strong> While your data stays local, be aware of legal risks around reproductive health data in your region.</li>
                  </ul>
                  <p className="text-orange-200 font-semibold pt-2">
                    By using this app, you acknowledge these risks and confirm you have your partner's explicit consent.
                  </p>
                </div>
              </div>
            </div>
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
                <h3 className="text-xl font-bold text-white mb-2">Get Your Daily Game Plan</h3>
                <p className="text-slate-400">Know when she's gonna be horny, hangry, or homicidal. Plan accordingly.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-3xl mx-auto mt-32 text-center bg-gradient-to-r from-cyan-500/20 to-blue-500/20 backdrop-blur-sm p-12 rounded-3xl border border-cyan-500/30">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Stop Stepping on Landmines?</h2>
          <p className="text-slate-300 mb-8 text-lg">Join guys who went from clueless to clutch. Your relationship will thank you.</p>
          <Button
            data-testid="cta-get-started-button"
            onClick={handleGetStarted}
            size="lg"
            className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg shadow-cyan-500/50"
          >
            Start Using - No Account Needed
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;

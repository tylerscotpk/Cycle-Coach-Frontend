import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import InfoNav from '@/components/InfoNav';
import AuthModal from '@/components/AuthModal';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || "";

const BASIC_FEATURES = [
  'Cycle tracking & phase predictions',
  'Phase-based tips & daily guidance',
  'Research-backed insights',
  'MoodMap visual guide',
  'Partner Profile customization',
  'Push notifications',
];
const ADVANCED_EXTRAS = [
  'AI Wingman — personalized advice 24/7',
  'Real-time relationship guidance',
  'AI-driven phase recommendations',
  'Personalized tips based on your data',
];

const InfoPricing = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState('signup');
  const [pendingAction, setPendingAction] = useState(null); // 'trial' | 'basic' | 'advanced'
  const [user, setUser] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);
  const [showDowngradeSuccess, setShowDowngradeSuccess] = useState(false);
  const [downgradeDate, setDowngradeDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      try { setUser(JSON.parse(userData)); } catch {}
    }
  }, []);

  const createCheckout = async (plan, currentUser = null) => {
    const u = currentUser || user;
    const sessionToken = localStorage.getItem('session_token');

    if (!sessionToken || !u) {
      setPendingAction(plan);
      setAuthView('signup');
      setAuthOpen(true);
      return;
    }

    if (!u.email_verified) {
      localStorage.setItem('pending_plan', plan);
      navigate('/verify-email');
      return;
    }

    setLoading(plan);
    try {
      const origin = window.location.origin;
      const res = await fetch(`${API}/api/subscription/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify({
          plan,
          success_url: `${origin}/checkout-success?plan=${plan}`,
          cancel_url: `${origin}/pricing`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create checkout');
      }
      const data = await res.json();
      window.location.href = data.checkout_url;
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
      setLoading(null);
    }
  };

  const handleAuthSuccess = ({ type, user: authUser, needsVerification }) => {
    setUser(authUser);
    if (needsVerification) {
      if (pendingAction) localStorage.setItem('pending_plan', pendingAction);
      navigate('/verify-email');
    } else if (pendingAction) {
      if (type === 'login' && authUser.plan_type && authUser.plan_type !== 'none' && authUser.plan_type !== 'expired') {
        // Already has a plan — reload pricing to show current plan
        setPendingAction(null);
        window.location.reload();
      } else {
        createCheckout(pendingAction, authUser);
        setPendingAction(null);
      }
    } else if (type === 'login') {
      window.location.reload();
    }
  };

  const handleLoginClick = () => {
    setAuthView('login');
    setPendingAction(null);
    setAuthOpen(true);
  };

  const handleUpgrade = async () => {
    setActionLoading(true);
    const sessionToken = localStorage.getItem('session_token');
    try {
      const res = await fetch(`${API}/api/subscription/upgrade`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Upgrade failed');
      }
      const data = await res.json();
      const updated = { ...user, plan_type: 'advanced', subscription_tier: 'advanced' };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
      setShowUpgradeModal(false);
      setShowUpgradeSuccess(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDowngrade = async () => {
    setActionLoading(true);
    const sessionToken = localStorage.getItem('session_token');
    try {
      const res = await fetch(`${API}/api/subscription/downgrade`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Downgrade failed');
      }
      const data = await res.json();
      setDowngradeDate(data.effective_date ? new Date(data.effective_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '');
      const updated = { ...user, plan_type: 'basic', subscription_tier: 'basic' };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
      setShowDowngradeModal(false);
      setShowDowngradeSuccess(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const currentPlan = user?.plan_type || 'none';
  const isLoggedIn = !!user;
  const hasPlan = currentPlan !== 'none' && currentPlan !== 'expired';

  return (
    <div className="min-h-screen">
      <InfoNav />

      {/* Hero */}
      <section className="relative pt-32 pb-12 px-6">
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-block bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-1.5 mb-6">
            <span className="text-cyan-400 text-sm font-semibold">7-Day Free Trial — Full Advanced Access</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight mb-6" data-testid="pricing-headline">
            Start Your 7-Day Trial and<br />Experience the Difference
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-4">
            Every feature unlocked for 7 days. After that, you&apos;re on Basic at $5/mo — or keep Advanced for $8/mo.
          </p>
          <p className="text-sm text-cyan-300/80 max-w-xl mx-auto mb-8 bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
            Your 7-day free trial includes full Advanced access. After your trial, you&apos;ll automatically be enrolled in the Basic plan at $5/mo. You can upgrade to Advanced anytime.
          </p>
          <Button
            onClick={() => createCheckout('trial')}
            disabled={loading === 'trial'}
            className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-6 text-lg font-semibold rounded-xl"
            data-testid="start-trial-btn"
          >
            {loading === 'trial' ? 'Loading...' : 'Start Free Trial'}
          </Button>
          <p className="text-slate-500 text-xs mt-3">Card required. $5/mo after trial ends. Cancel anytime.</p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            {hasPlan ? 'Your Plan' : 'Or Skip the Trial'}
          </h2>
          <p className="text-slate-400 text-center mb-10">
            {hasPlan ? `You're on the ${currentPlan === 'trial' ? 'Free Trial (Advanced)' : currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} plan` : 'Jump straight in with the plan that fits.'}
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Basic */}
            <Card className={`bg-slate-900/80 border-slate-700/50 flex flex-col ${currentPlan === 'basic' ? 'ring-2 ring-cyan-500/50 border-cyan-500/30' : 'ring-1 ring-slate-600/50'}`} data-testid="plan-basic">
              {currentPlan === 'basic' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider z-10">
                  Current Plan
                </div>
              )}
              <CardHeader className="flex-1 pt-8 relative">
                <CardTitle className="text-white text-2xl font-bold">Basic</CardTitle>
                <p className="text-slate-400 text-sm mt-1">Core cycle intelligence</p>
                <div className="mt-5">
                  <span className="text-5xl font-bold text-white">$5</span>
                  <span className="text-slate-400 ml-1 text-lg">/month</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex-1 flex flex-col">
                <ul className="space-y-3 mb-8 flex-1">
                  {BASIC_FEATURES.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-slate-300 text-sm">
                      <svg className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                  <li className="flex items-start gap-2.5 text-slate-500 text-sm">
                    <svg className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="line-through">AI Wingman</span>
                  </li>
                </ul>
                {currentPlan === 'advanced' ? (
                  <Button onClick={() => setShowDowngradeModal(true)}
                    className="w-full py-5 text-base font-semibold bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                    data-testid="downgrade-btn">
                    Downgrade to Basic
                  </Button>
                ) : currentPlan === 'basic' ? (
                  <Button disabled className="w-full py-5 text-base font-semibold bg-slate-700/50 text-slate-500 border border-slate-700">
                    Current Plan
                  </Button>
                ) : (
                  <Button onClick={() => createCheckout('basic')} disabled={loading === 'basic'}
                    className="w-full py-5 text-base font-semibold bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                    data-testid="select-basic-btn">
                    {loading === 'basic' ? 'Loading...' : 'Get Basic'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Advanced */}
            <Card className={`bg-slate-900/80 border-slate-700/50 flex flex-col relative ${currentPlan === 'advanced' || currentPlan === 'trial' ? 'ring-2 ring-emerald-500/50 border-emerald-500/30' : 'ring-2 ring-emerald-500/50 border-emerald-500/30'}`} data-testid="plan-advanced">
              {currentPlan === 'advanced' ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                  Current Plan
                </div>
              ) : currentPlan === 'trial' ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                  Trial Active
                </div>
              ) : (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                  Most Popular
                </div>
              )}
              <CardHeader className="flex-1 pt-8">
                <CardTitle className="text-white text-2xl font-bold">Advanced</CardTitle>
                <p className="text-slate-400 text-sm mt-1">Full access + AI-powered coaching</p>
                <div className="mt-5">
                  <span className="text-5xl font-bold text-white">$8</span>
                  <span className="text-slate-400 ml-1 text-lg">/month</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex-1 flex flex-col">
                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                    <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Everything in Basic
                  </li>
                  {ADVANCED_EXTRAS.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-slate-300 text-sm">
                      <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                {currentPlan === 'basic' ? (
                  <Button onClick={() => setShowUpgradeModal(true)}
                    className="w-full py-5 text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-white"
                    data-testid="upgrade-btn">
                    Upgrade to Advanced
                  </Button>
                ) : currentPlan === 'advanced' ? (
                  <Button disabled className="w-full py-5 text-base font-semibold bg-emerald-500/50 text-white/50">
                    Current Plan
                  </Button>
                ) : (
                  <Button onClick={() => createCheckout('advanced')} disabled={loading === 'advanced'}
                    className="w-full py-5 text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-white"
                    data-testid="select-advanced-btn">
                    {loading === 'advanced' ? 'Loading...' : 'Unlock AI-Guided Performance'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex flex-wrap justify-center gap-8 text-slate-500 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Secure Payment via Stripe
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              All Data Stays on Your Device
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Cancel Anytime
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {!isLoggedIn && (
            <p className="text-slate-500">
              Already have an account?{' '}
              <button onClick={handleLoginClick} className="text-cyan-400 hover:text-cyan-300 font-medium">
                Log In
              </button>
            </p>
          )}
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-slate-500 text-sm">&copy; {new Date().getFullYear()} Stars & Honey, LLC. All rights reserved.</p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultView={authView} onSuccess={handleAuthSuccess} />

      {/* Upgrade Comparison Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg" data-testid="upgrade-modal">
          <DialogHeader>
            <DialogTitle className="text-xl">Upgrade to Advanced</DialogTitle>
            <DialogDescription className="text-slate-400">Compare what you get</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-slate-400 text-sm font-medium">You currently have Basic. Advanced adds:</p>
            {ADVANCED_EXTRAS.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-emerald-300 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {f}
              </div>
            ))}
            <div className="bg-slate-700/50 rounded-lg p-3 mt-4">
              <p className="text-white text-sm">$5/mo → <strong>$8/mo</strong>. Prorated for this billing period.</p>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleUpgrade} disabled={actionLoading}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white" data-testid="confirm-upgrade-btn">
              {actionLoading ? 'Upgrading...' : 'Confirm Upgrade'}
            </Button>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setShowUpgradeModal(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Success Modal */}
      <Dialog open={showUpgradeSuccess} onOpenChange={setShowUpgradeSuccess}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md" data-testid="upgrade-success-modal">
          <div className="text-center py-4">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-2">You&apos;re on Advanced!</h2>
            <p className="text-slate-400 mb-4">Welcome to the full Cycle Coach experience.</p>
            <ul className="text-left space-y-2 mb-6">
              {ADVANCED_EXTRAS.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-emerald-300 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Button onClick={() => { setShowUpgradeSuccess(false); navigate('/app'); }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-8">
              Go to Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Downgrade Warning Modal */}
      <Dialog open={showDowngradeModal} onOpenChange={setShowDowngradeModal}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md" data-testid="downgrade-modal">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">Downgrade to Basic?</DialogTitle>
            <DialogDescription className="text-red-300 mt-2">
              You will lose access to Advanced features at the end of your current billing period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <p className="text-slate-400 text-sm font-medium">You&apos;ll lose:</p>
            {ADVANCED_EXTRAS.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-red-300/80 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {f}
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleDowngrade} disabled={actionLoading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white" data-testid="confirm-downgrade-btn">
              {actionLoading ? 'Processing...' : 'Confirm Downgrade'}
            </Button>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setShowDowngradeModal(false)}>
              Keep Advanced
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Downgrade Success Modal */}
      <Dialog open={showDowngradeSuccess} onOpenChange={setShowDowngradeSuccess}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md" data-testid="downgrade-success-modal">
          <div className="text-center py-4">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-xl font-bold text-white mb-2">Downgrade Scheduled</h2>
            <p className="text-slate-400 mb-2">
              You&apos;ll keep Advanced access until the end of your current billing period{downgradeDate ? ` (${downgradeDate})` : ''}.
            </p>
            <p className="text-slate-500 text-sm mb-6">After that, you&apos;ll be on the Basic plan at $5/mo.</p>
            <Button onClick={() => { setShowDowngradeSuccess(false); navigate('/app'); }}
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-8">
              Back to Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InfoPricing;

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LocalStorage } from '../utils/localStorageManager';

const API = process.env.REACT_APP_BACKEND_URL;

// Subscription Plans (cached locally - no API fetch needed)
const SUBSCRIPTION_PLANS = {
  monthly: {
    id: 'monthly',
    name: 'Monthly Training Plan',
    price: 3.99,
    priceDisplay: '$3.99',
    billing: 'Monthly',
    billingPeriod: '/month',
    hasTrial: true,
    trialDays: 7,
    description: 'Start strong with guided training and personalized insights. Free 7-day trial.',
    paymentLink: 'https://buy.stripe.com/7sYbJ219f3rG7F86j953O04',
    features: ['Cycle tracking & predictions', 'Research-backed insights', 'Educational resources', 'Partner Profile', 'AI Wingman'],
    badge: '7-DAY FREE TRIAL',
    badgeColor: 'bg-emerald-500'
  },
  quarterly: {
    id: 'quarterly',
    name: 'Quarter by Quarter',
    price: 10.49,
    priceDisplay: '$10.49',
    billing: 'Every 3 months',
    billingPeriod: '/3 months',
    hasTrial: false,
    description: 'Stay consistent with a 90-day cycle designed for real relationship progress. Save compared to monthly.',
    paymentLink: 'https://buy.stripe.com/4gM3cw05b5zO7F86j953O07',
    features: ['Cycle tracking & predictions', 'Research-backed insights', 'Educational resources', 'Partner Profile', 'AI Wingman'],
    savings: 'Save 12%',
    badge: 'SAVE 12%',
    badgeColor: 'bg-cyan-500'
  },
  annual: {
    id: 'annual',
    name: 'Full Season Strategy',
    price: 35.91,
    priceDisplay: '$35.91',
    billing: 'Annual',
    billingPeriod: '/year',
    hasTrial: false,
    description: 'Commit to long-term growth. Best value — includes 3 free months compared to monthly.',
    paymentLink: 'https://buy.stripe.com/aFa7sMg491jy8Jc36X53O06',
    features: ['Cycle tracking & predictions', 'Research-backed insights', 'Educational resources', 'Partner Profile', 'AI Wingman'],
    savings: '3 months free',
    badge: 'BEST VALUE',
    badgeColor: 'bg-purple-500',
    recommended: true
  }
};

const Paywall = ({ onUnlock }) => {
  const [activeView, setActiveView] = useState('plans'); // 'plans' or 'login'
  const [licenseKey, setLicenseKey] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [returningEmail, setReturningEmail] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [keySent, setKeySent] = useState(false);

  // Check URL params for subscription success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const subscriptionStatus = urlParams.get('subscription');
    const trialStatus = urlParams.get('trial');
    
    if (subscriptionStatus === 'success' || trialStatus === 'success') {
      toast.success('🎉 Subscription activated! Check your email for your license key.');
      window.history.replaceState({}, document.title, window.location.pathname);
      setActiveView('login');
    } else if (subscriptionStatus === 'cancelled' || trialStatus === 'cancelled') {
      toast.info('No worries! Come back when you\'re ready.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleValidateLicense = async (e) => {
    e.preventDefault();
    setIsValidating(true);

    try {
      const normalizedKey = licenseKey.trim().toUpperCase();
      
      const response = await fetch(`${API}/api/license/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: normalizedKey })
      });
      
      const result = await response.json();
      
      if (result.valid) {
        LocalStorage.saveLicenseKey(normalizedKey);
        LocalStorage.saveSubscriptionTier({
          tier: result.tier,
          tier_display: result.tier_display,
          has_partner_profile: result.has_partner_profile,
          has_ai_wingman: result.has_ai_wingman,
          expires_at: result.expires_at,
          email: result.email,
          is_trial: result.is_trial,
          created_at: result.created_at,
          customer_id: result.customer_id,
          subscription_id: result.subscription_id,
          cancels_at: result.cancels_at,
          is_cancelled: result.is_cancelled
        });
        
        toast.success(`Welcome to Cycle Coach!`);
        onUnlock();
      } else {
        toast.error(result.message || 'Invalid license key. Please check and try again.');
      }
    } catch (error) {
      console.error('License validation error:', error);
      toast.error('Unable to validate license. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleResendLicense = async (e) => {
    e.preventDefault();
    setIsResending(true);

    try {
      const response = await fetch(`${API}/api/license/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: returningEmail.trim().toLowerCase() })
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setKeySent(true);
        toast.success('License key sent to your email!');
      } else if (result.status === 'not_found') {
        toast.error('No license found for this email. Choose a plan to get started!');
      } else {
        toast.error(result.message || 'Unable to resend. Please try again.');
      }
    } catch (error) {
      console.error('Resend error:', error);
      toast.error('Unable to resend license. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSelectPlan = (planId) => {
    if (!userEmail.trim()) {
      toast.error('Please enter your email first');
      return;
    }

    const plan = SUBSCRIPTION_PLANS[planId];
    if (plan && plan.paymentLink) {
      const email = encodeURIComponent(userEmail.trim().toLowerCase());
      window.location.href = `${plan.paymentLink}?prefilled_email=${email}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-5xl w-full space-y-6">
        {/* Logo/Brand */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Cycle Coach</h1>
          <p className="text-slate-400 text-sm sm:text-base">The relationship game-changer</p>
        </div>

        {/* View Switcher */}
        <div className="flex bg-slate-800 rounded-lg p-1 max-w-md mx-auto">
          <button
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeView === 'plans' 
                ? 'bg-cyan-500 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setActiveView('plans')}
            data-testid="plans-tab"
          >
            Choose Game Plan
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeView === 'login' 
                ? 'bg-cyan-500 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setActiveView('login')}
            data-testid="login-tab"
          >
            I Have a Key
          </button>
        </div>

        {activeView === 'plans' ? (
          /* PRICING PLANS VIEW */
          <div className="space-y-6">
            {/* Email Input */}
            <div className="max-w-md mx-auto">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <Label htmlFor="email-input" className="text-slate-300 text-sm">
                    Enter your email to get started
                  </Label>
                  <Input
                    id="email-input"
                    type="email"
                    data-testid="user-email-input"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="bg-slate-700/50 border-slate-600 text-white mt-2"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-3 gap-4 sm:gap-6 items-stretch">
              {/* Monthly Training Plan */}
              <Card className="bg-slate-800/90 border-slate-700 hover:border-emerald-500/50 transition-all relative overflow-hidden flex flex-col h-full" data-testid="monthly-plan-card">
                <div className="absolute top-0 left-0 right-0 bg-emerald-500 text-white text-xs font-bold py-1 text-center">
                  7-DAY FREE TRIAL
                </div>
                <CardHeader className="text-center pb-2 pt-8">
                  <CardTitle className="text-xl text-white">{SUBSCRIPTION_PLANS.monthly.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-white">{SUBSCRIPTION_PLANS.monthly.priceDisplay}</span>
                    <span className="text-slate-400 text-sm ml-1">{SUBSCRIPTION_PLANS.monthly.billingPeriod}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-slate-400 text-sm text-center mb-4">
                    {SUBSCRIPTION_PLANS.monthly.description}
                  </p>
                  <ul className="space-y-2 text-sm text-slate-300 flex-1">
                    {SUBSCRIPTION_PLANS.monthly.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="text-emerald-400">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleSelectPlan('monthly')}
                    disabled={!userEmail.trim()}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white mt-4"
                    data-testid="select-monthly-btn"
                  >
                    Start Free Trial
                  </Button>
                </CardContent>
              </Card>

              {/* Quarter by Quarter */}
              <Card className="bg-slate-800/90 border-slate-700 hover:border-cyan-500/50 transition-all relative overflow-hidden flex flex-col h-full" data-testid="quarterly-plan-card">
                <div className="absolute top-0 left-0 right-0 bg-cyan-500 text-white text-xs font-bold py-1 text-center">
                  SAVE 12%
                </div>
                <CardHeader className="text-center pb-2 pt-8">
                  <CardTitle className="text-xl text-white">{SUBSCRIPTION_PLANS.quarterly.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-white">{SUBSCRIPTION_PLANS.quarterly.priceDisplay}</span>
                    <span className="text-slate-400 text-sm ml-1">{SUBSCRIPTION_PLANS.quarterly.billingPeriod}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-slate-400 text-sm text-center mb-4">
                    {SUBSCRIPTION_PLANS.quarterly.description}
                  </p>
                  <ul className="space-y-2 text-sm text-slate-300 flex-1">
                    {SUBSCRIPTION_PLANS.quarterly.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="text-cyan-400">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleSelectPlan('quarterly')}
                    disabled={!userEmail.trim()}
                    className="w-full bg-cyan-400 hover:bg-cyan-500 text-white mt-4"
                    data-testid="select-quarterly-btn"
                  >
                    Choose Quarterly
                  </Button>
                </CardContent>
              </Card>

              {/* Full Season Strategy */}
              <Card className="bg-gradient-to-b from-purple-900/50 to-slate-800/90 border-purple-500/50 relative overflow-hidden flex flex-col" data-testid="annual-plan-card">
                <div className="absolute top-0 left-0 right-0 bg-purple-500 text-white text-xs font-bold py-1 text-center">
                  BEST VALUE
                </div>
                <CardHeader className="text-center pb-2 pt-8">
                  <CardTitle className="text-xl text-white">{SUBSCRIPTION_PLANS.annual.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-white">{SUBSCRIPTION_PLANS.annual.priceDisplay}</span>
                    <span className="text-slate-400 text-sm ml-1">{SUBSCRIPTION_PLANS.annual.billingPeriod}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col">
                  <p className="text-slate-400 text-sm text-center">
                    {SUBSCRIPTION_PLANS.annual.description}
                  </p>
                  <ul className="space-y-2 text-sm text-slate-300">
                    {SUBSCRIPTION_PLANS.annual.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="text-purple-400">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-4">
                    <Button
                      onClick={() => handleSelectPlan('annual')}
                      disabled={!userEmail.trim()}
                      className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                      data-testid="select-annual-btn"
                    >
                      Go Annual
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Feature Comparison Note */}
            <div className="text-center text-slate-400 text-sm max-w-lg mx-auto">
              <p>🔒 All plans include full access. Your data stays on your device.</p>
              <p className="mt-1 text-slate-500">Cancel anytime. Secure payment via Stripe.</p>
            </div>
          </div>
        ) : (
          /* LOGIN VIEW */
          <Card className="bg-slate-800/90 backdrop-blur-sm border-slate-700 max-w-md mx-auto">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl text-white">Welcome Back</CardTitle>
              <CardDescription className="text-slate-400">
                Enter your license key or resend it
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* License Key Input */}
              <form onSubmit={handleValidateLicense} className="space-y-4">
                <div>
                  <Label htmlFor="license-key" className="text-slate-300 text-sm">
                    Enter your license key
                  </Label>
                  <Input
                    id="license-key"
                    data-testid="license-key-input"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="CC-XXXX-XXXX-XXXX"
                    className="bg-slate-700/50 border-slate-600 text-white mt-2 uppercase text-center text-lg tracking-wider"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-5"
                  disabled={isValidating || !licenseKey.trim()}
                  data-testid="activate-license-btn"
                >
                  {isValidating ? 'Validating...' : 'Activate License'}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-600"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-800 px-2 text-slate-500">Forgot your key?</span>
                </div>
              </div>

              {/* Resend License Key */}
              {!keySent ? (
                <form onSubmit={handleResendLicense} className="space-y-4">
                  <div>
                    <Label htmlFor="returning-email" className="text-slate-300 text-sm">
                      Enter your email to resend license key
                    </Label>
                    <Input
                      id="returning-email"
                      type="email"
                      data-testid="resend-email-input"
                      value={returningEmail}
                      onChange={(e) => setReturningEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="bg-slate-700/50 border-slate-600 text-white mt-2"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                    disabled={isResending || !returningEmail.trim()}
                    data-testid="resend-key-btn"
                  >
                    {isResending ? 'Sending...' : 'Resend License Key'}
                  </Button>
                </form>
              ) : (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                  <div className="text-green-400 text-2xl mb-2">✉️</div>
                  <p className="text-green-300 font-medium">License Key Sent!</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Check your email and enter the key above.
                  </p>
                </div>
              )}

              {/* Back to Plans */}
              <div className="text-center">
                <button
                  onClick={() => setActiveView('plans')}
                  className="text-cyan-400 hover:text-cyan-300 text-sm underline"
                  data-testid="back-to-plans-btn"
                >
                  Don&apos;t have a key? Choose your Game Plan
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Privacy Note */}
        <div className="text-center">
          <p className="text-xs text-slate-500">
            🔒 Your data stays on your device. No account required.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Paywall;

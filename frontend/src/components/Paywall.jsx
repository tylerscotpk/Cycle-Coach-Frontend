import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LocalStorage } from '../utils/localStorageManager';

const API = process.env.REACT_APP_BACKEND_URL;

// Stripe Payment Links
const STRIPE_LINKS = {
  free_training: 'https://buy.stripe.com/4gMaEYdW1e6kbVo36X53O03',
  winning: 'https://buy.stripe.com/3cI4gA3hn6DS6B4azp53O01',
  elite: 'https://buy.stripe.com/8x26oI19ffao9Ng4b153O02'
};

const Paywall = ({ onUnlock }) => {
  const [activeView, setActiveView] = useState('plans'); // 'plans' or 'login'
  const [licenseKey, setLicenseKey] = useState('');
  const [trialEmail, setTrialEmail] = useState('');
  const [returningEmail, setReturningEmail] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [keySent, setKeySent] = useState(false);

  // Check URL params for subscription success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const trialStatus = urlParams.get('trial');
    const subscriptionStatus = urlParams.get('subscription');
    const upgradeStatus = urlParams.get('upgrade');
    const tier = urlParams.get('tier');
    
    if (trialStatus === 'success') {
      toast.success('🏆 Free Training activated! Check your email for your license key.');
      window.history.replaceState({}, document.title, window.location.pathname);
      setActiveView('login');
    } else if (subscriptionStatus === 'success' || upgradeStatus === 'success') {
      const tierName = tier === 'elite' ? 'Elite Game Plan' : 'Winning Game Plan';
      toast.success(`🎉 ${tierName} activated! Check your email for your license key.`);
      window.history.replaceState({}, document.title, window.location.pathname);
      setActiveView('login');
    } else if (trialStatus === 'cancelled' || subscriptionStatus === 'cancelled' || upgradeStatus === 'cancelled') {
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
        // Save license key and tier info
        LocalStorage.saveLicenseKey(normalizedKey);
        LocalStorage.saveSubscriptionTier({
          tier: result.tier,
          tier_display: result.tier_display,
          has_partner_profile: result.has_partner_profile,
          has_ai_wingman: result.has_ai_wingman,
          expires_at: result.expires_at,
          email: result.email,
          is_trial: result.is_trial,
          created_at: result.created_at
        });
        
        toast.success(`Welcome to Cycle Coach ${result.tier_display || result.tier}!`);
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
        toast.error('No license found for this email. Try starting Free Training!');
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

  const handleStartFreeTrial = async () => {
    if (!trialEmail.trim()) {
      toast.error('Please enter your email first');
      return;
    }

    // Redirect to Stripe payment link with prefilled email
    const email = encodeURIComponent(trialEmail.trim().toLowerCase());
    window.location.href = `${STRIPE_LINKS.free_training}?prefilled_email=${email}`;
  };

  const handleSubscribe = async (tier) => {
    if (!trialEmail.trim()) {
      toast.error('Please enter your email first');
      return;
    }

    const email = encodeURIComponent(trialEmail.trim().toLowerCase());
    const link = STRIPE_LINKS[tier];
    
    if (link) {
      window.location.href = `${link}?prefilled_email=${email}`;
    } else {
      toast.error('Invalid plan selected');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-4xl w-full space-y-6">
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
                    data-testid="trial-email-input"
                    value={trialEmail}
                    onChange={(e) => setTrialEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="bg-slate-700/50 border-slate-600 text-white mt-2"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
              {/* Free Training */}
              <Card className="bg-slate-800/90 border-slate-700 hover:border-emerald-500/50 transition-all" data-testid="free-training-card">
                <CardHeader className="text-center pb-2">
                  <div className="text-emerald-400 text-sm font-semibold mb-2">START HERE</div>
                  <CardTitle className="text-xl text-white">Free Training</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-white">$0</span>
                    <span className="text-slate-400 text-sm ml-1">/ 30 days</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Then $1.99/mo • Cancel anytime</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span>
                      Cycle tracking &amp; predictions
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span>
                      Research-backed insights
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span>
                      Educational resources
                    </li>
                    <li className="flex items-center gap-2 text-slate-500">
                      <span>✗</span>
                      Partner Profile
                    </li>
                    <li className="flex items-center gap-2 text-slate-500">
                      <span>✗</span>
                      AI Wingman
                    </li>
                  </ul>
                  <Button
                    onClick={handleStartFreeTrial}
                    disabled={!trialEmail.trim()}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                    data-testid="start-training-btn"
                  >
                    Start Free Training
                  </Button>
                </CardContent>
              </Card>

              {/* Winning Game Plan */}
              <Card className="bg-slate-800/90 border-slate-700 hover:border-cyan-500/50 transition-all" data-testid="winning-plan-card">
                <CardHeader className="text-center pb-2">
                  <div className="text-cyan-400 text-sm font-semibold mb-2">WINNING</div>
                  <CardTitle className="text-xl text-white">Winning Game Plan</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-white">$1.99</span>
                    <span className="text-slate-400 text-sm ml-1">/ month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li className="flex items-center gap-2">
                      <span className="text-cyan-400">✓</span>
                      Cycle tracking &amp; predictions
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-cyan-400">✓</span>
                      Research-backed insights
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-cyan-400">✓</span>
                      Educational resources
                    </li>
                    <li className="flex items-center gap-2 text-slate-500">
                      <span>✗</span>
                      Partner Profile
                    </li>
                    <li className="flex items-center gap-2 text-slate-500">
                      <span>✗</span>
                      AI Wingman
                    </li>
                  </ul>
                  <Button
                    onClick={() => handleSubscribe('winning')}
                    disabled={!trialEmail.trim()}
                    variant="outline"
                    className="w-full border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-white"
                    data-testid="subscribe-winning-btn"
                  >
                    Choose Winning
                  </Button>
                </CardContent>
              </Card>

              {/* Elite Game Plan */}
              <Card className="bg-gradient-to-b from-purple-900/50 to-slate-800/90 border-purple-500/50 relative overflow-hidden" data-testid="elite-plan-card">
                <div className="absolute top-0 right-0 bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-bl">
                  RECOMMENDED
                </div>
                <CardHeader className="text-center pb-2 pt-6">
                  <div className="text-purple-400 text-sm font-semibold mb-2">ELITE</div>
                  <CardTitle className="text-xl text-white">Elite Game Plan</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-white">$2.99</span>
                    <span className="text-slate-400 text-sm ml-1">/ month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li className="flex items-center gap-2">
                      <span className="text-purple-400">✓</span>
                      Cycle tracking &amp; predictions
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-purple-400">✓</span>
                      Research-backed insights
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-purple-400">✓</span>
                      Educational resources
                    </li>
                    <li className="flex items-center gap-2 font-semibold">
                      <span className="text-purple-400">✓</span>
                      Partner Profile
                    </li>
                    <li className="flex items-center gap-2 font-semibold">
                      <span className="text-purple-400">✓</span>
                      AI Wingman - 24/7 advice
                    </li>
                  </ul>
                  <Button
                    onClick={() => handleSubscribe('elite')}
                    disabled={!trialEmail.trim()}
                    className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                    data-testid="subscribe-elite-btn"
                  >
                    Go Elite
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Feature Comparison Note */}
            <div className="text-center text-slate-400 text-sm max-w-lg mx-auto">
              <p>🔒 All plans: Your data stays on your device. No account required.</p>
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

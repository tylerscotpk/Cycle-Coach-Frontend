import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LocalStorage } from '../utils/localStorageManager';

const API = process.env.REACT_APP_BACKEND_URL;
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/test_7sY28t65k9Q18VS5dienS00';

const Paywall = ({ onUnlock }) => {
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'returning'
  const [licenseKey, setLicenseKey] = useState('');
  const [trialEmail, setTrialEmail] = useState('');
  const [returningEmail, setReturningEmail] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isRequestingTrial, setIsRequestingTrial] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showTrialForm, setShowTrialForm] = useState(false);
  const [trialRequested, setTrialRequested] = useState(false);
  const [keySent, setKeySent] = useState(false);

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
        toast.success('Welcome back to Cycle Coach!');
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
        toast.error('No license found for this email. Try requesting a trial instead.');
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

  const handleRequestTrial = async (e) => {
    e.preventDefault();
    setIsRequestingTrial(true);

    try {
      const response = await fetch(`${API}/api/trial/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trialEmail.trim().toLowerCase() })
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setTrialRequested(true);
        toast.success('Trial request submitted!');
      } else if (result.status === 'already_licensed') {
        toast.info('You already have a license! Check your email or use "Returning User" to resend it.');
      } else if (result.status === 'already_requested') {
        setTrialRequested(true);
        toast.info('Request already submitted. We\'ll email you soon!');
      } else if (result.status === 'already_approved') {
        toast.success('Your trial is approved! Check your email for the license key.');
      } else {
        toast.error(result.message || 'Something went wrong');
      }
    } catch (error) {
      console.error('Trial request error:', error);
      toast.error('Unable to submit request. Please try again.');
    } finally {
      setIsRequestingTrial(false);
    }
  };

  const handleBuyNow = () => {
    window.open(STRIPE_PAYMENT_LINK, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Cycle Coach</h1>
          <p className="text-slate-400">Your personal trainer for peak relationship performance</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-800 rounded-lg p-1">
          <button
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'new' 
                ? 'bg-cyan-500 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('new')}
          >
            New User
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'returning' 
                ? 'bg-cyan-500 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('returning')}
          >
            Returning User
          </button>
        </div>

        {/* Main Card */}
        <Card className="bg-slate-800/90 backdrop-blur-sm border-slate-700">
          {activeTab === 'new' ? (
            /* NEW USER TAB */
            <>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl text-white">Get Started</CardTitle>
                <CardDescription className="text-slate-400">
                  Request a free trial or purchase access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Features List */}
                <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
                  <h4 className="text-white font-semibold text-sm uppercase tracking-wide">What you get:</h4>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="text-cyan-400">✓</span>
                      Cycle tracking & phase predictions
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-cyan-400">✓</span>
                      AI Wingman for personalized advice
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-cyan-400">✓</span>
                      Research-backed insights & tips
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-cyan-400">✓</span>
                      100% privacy - data stays on your device
                    </li>
                  </ul>
                </div>

                {/* Request Trial Button */}
                {!showTrialForm && !trialRequested && (
                  <Button
                    onClick={() => setShowTrialForm(true)}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-6 text-lg font-semibold"
                    data-testid="request-trial-button"
                  >
                    Request Free Trial
                  </Button>
                )}

                {/* Trial Request Form */}
                {showTrialForm && !trialRequested && (
                  <form onSubmit={handleRequestTrial} className="space-y-4">
                    <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                      <Label htmlFor="trial-email" className="text-cyan-300 text-sm font-medium">
                        Enter your email to request trial access
                      </Label>
                      <Input
                        id="trial-email"
                        type="email"
                        data-testid="trial-email-input"
                        value={trialEmail}
                        onChange={(e) => setTrialEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="bg-slate-700/50 border-slate-600 text-white mt-2"
                        required
                      />
                      <p className="text-xs text-slate-400 mt-2">
                        We'll review your request and email you a license key.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowTrialForm(false)}
                        className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"
                        disabled={isRequestingTrial || !trialEmail.trim()}
                        data-testid="submit-trial-button"
                      >
                        {isRequestingTrial ? 'Submitting...' : 'Submit Request'}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Trial Requested Confirmation */}
                {trialRequested && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                    <div className="text-green-400 text-2xl mb-2">✓</div>
                    <p className="text-green-300 font-medium">Trial Request Submitted!</p>
                    <p className="text-slate-400 text-sm mt-1">
                      Check your email - we'll send your license key soon.
                    </p>
                  </div>
                )}

                <p className="text-xs text-slate-500 text-center">
                  License keys are sent via email after approval.
                </p>
              </CardContent>
            </>
          ) : (
            /* RETURNING USER TAB */
            <>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl text-white">Welcome Back</CardTitle>
                <CardDescription className="text-slate-400">
                  Enter your license key or resend it to your email
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
                    data-testid="activate-license-button"
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
              </CardContent>
            </>
          )}
        </Card>

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

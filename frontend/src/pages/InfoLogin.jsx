import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LocalStorage } from '@/utils/localStorageManager';
import InfoNav from '@/components/InfoNav';

const API = process.env.REACT_APP_BACKEND_URL;

const InfoLogin = () => {
  const navigate = useNavigate();
  const [licenseKey, setLicenseKey] = useState('');
  const [email, setEmail] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showResend, setShowResend] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!licenseKey.trim()) {
      toast.error('Please enter your license key');
      return;
    }

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
        
        toast.success('Welcome to Cycle Coach!');
        // Redirect to the app dashboard
        window.location.href = '/app';
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

  const handleResendKey = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }

    setIsResending(true);

    try {
      const response = await fetch(`${API}/api/license/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        toast.success('License key sent to your email!');
        setShowResend(false);
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

  return (
    <div className="min-h-screen bg-slate-950">
      <InfoNav />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-40 right-20 w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-md mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight mb-6 text-center" data-testid="login-headline">
            Log In
          </h1>
          
          <Card className="bg-slate-900/80 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-white text-xl">Enter Your License Key</CardTitle>
              <CardDescription className="text-slate-400">
                Use the license key from your confirmation email to access your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    License Key
                  </label>
                  <Input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 font-mono"
                    data-testid="license-key-input"
                  />
                </div>
                
                <Button
                  type="submit"
                  disabled={isValidating}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-6 text-lg font-semibold"
                  data-testid="login-submit-btn"
                >
                  {isValidating ? 'Validating...' : 'Log In'}
                </Button>
              </form>

              {/* Forgot Key Section */}
              <div className="mt-6 pt-6 border-t border-slate-700">
                {!showResend ? (
                  <button
                    onClick={() => setShowResend(true)}
                    className="text-cyan-400 hover:text-cyan-300 text-sm w-full text-center"
                    data-testid="forgot-key-link"
                  >
                    Forgot your license key?
                  </button>
                ) : (
                  <form onSubmit={handleResendKey} className="space-y-4">
                    <p className="text-slate-400 text-sm">Enter your email to receive your license key:</p>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      data-testid="resend-email-input"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowResend(false)}
                        className="flex-1 border-slate-600 text-slate-300"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isResending}
                        className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"
                        data-testid="resend-submit-btn"
                      >
                        {isResending ? 'Sending...' : 'Send Key'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              {/* Link to Pricing */}
              <div className="mt-6 text-center">
                <p className="text-slate-500 text-sm">
                  Don't have a plan yet?{' '}
                  <Link to="/signup" className="text-cyan-400 hover:text-cyan-300" data-testid="view-pricing-link">
                    View Pricing
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-800/50 mt-auto">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Stars & Honey, LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default InfoLogin;

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { LocalStorage } from '@/utils/localStorageManager';
import InfoNav from '@/components/InfoNav';

const API = process.env.REACT_APP_BACKEND_URL;

const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly Training Camp',
    price: '$4',
    period: '/month',
    description: 'A flexible month-to-month plan for men who want consistent guidance and support without long-term commitment.',
    paymentLink: process.env.REACT_APP_STRIPE_MONTHLY_LINK,
    highlight: false,
    badge: null,
    badgeColor: null,
    buttonStyle: 'default',
  },
  {
    id: 'quarterly',
    name: 'Quarter by Quarter',
    price: '$10',
    period: '/3 months',
    description: 'A seasonal approach that builds rhythm and momentum. Perfect for couples who want deeper structure and stability.',
    paymentLink: process.env.REACT_APP_STRIPE_QUARTERLY_LINK,
    highlight: 'cyan',
    badge: 'Free 14-Day Trial',
    badgeColor: 'text-cyan-400',
    buttonStyle: 'cyan',
  },
  {
    id: 'yearly',
    name: 'Full Season Strategy',
    price: '$32',
    period: '/year',
    description: 'The full-year plan for men committed to long-term growth, mastery, and leading their relationship with intention.',
    paymentLink: process.env.REACT_APP_STRIPE_ANNUAL_LINK,
    highlight: 'green',
    badge: 'Best Value',
    badgeColor: 'text-emerald-400',
    buttonStyle: 'green',
  },
];

const InfoPricing = () => {
  const [licenseKey, setLicenseKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleSelectPlan = (plan) => {
    window.location.href = plan.paymentLink;
  };

  const handleValidateKey = async (e) => {
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

  return (
    <div className="min-h-screen bg-slate-950">
      <InfoNav />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-40 right-20 w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight mb-6" data-testid="pricing-headline">
            Choose Your Training Plan
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Three ways to stay in sync — pick the one that fits your season.
          </p>
        </div>
      </section>

      {/* Already Have a Key Section */}
      <section className="pt-8 px-6">
        <div className="max-w-md mx-auto">
          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardContent className="py-6">
              <form onSubmit={handleValidateKey} className="space-y-4">
                <div className="text-center mb-4">
                  <p className="text-slate-300 font-medium">Already have a login key?</p>
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">
                    Enter your login key
                  </label>
                  <Input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 font-mono"
                    data-testid="pricing-license-key-input"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isValidating}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                  data-testid="pricing-validate-key-btn"
                >
                  {isValidating ? 'Validating...' : 'Submit'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {PLANS.map((plan) => (
              <Card 
                key={plan.id}
                className={`bg-slate-900/80 border-slate-700/50 flex flex-col ${
                  plan.highlight === 'cyan' ? 'ring-2 ring-cyan-500/50 border-cyan-500/30' : 
                  plan.highlight === 'green' ? 'ring-2 ring-emerald-500/50 border-emerald-500/30' : ''
                }`}
                data-testid={`plan-${plan.id}`}
              >
                <CardHeader className="flex-1">
                  {plan.badge && (
                    <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${plan.badgeColor}`}>
                      {plan.badge}
                    </div>
                  )}
                  <CardTitle className="text-white text-2xl font-bold">
                    {plan.name}
                  </CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    <span className="text-slate-400 ml-1">{plan.period}</span>
                  </div>
                  <CardDescription className="text-slate-400 mt-4 text-base leading-relaxed">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full py-6 text-lg font-semibold ${
                      plan.buttonStyle === 'cyan' 
                        ? 'bg-cyan-500 hover:bg-cyan-600 text-white' 
                        : plan.buttonStyle === 'green'
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
                    }`}
                    data-testid={`select-${plan.id}-btn`}
                  >
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex flex-wrap justify-center gap-8 text-slate-500 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Secure Payment</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Privacy Protected</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Cancel Anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Stars & Honey, LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default InfoPricing;

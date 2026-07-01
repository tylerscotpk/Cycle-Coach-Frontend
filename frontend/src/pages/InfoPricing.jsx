import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import InfoNav from '@/components/InfoNav';
import { toast } from 'sonner';

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: '$9',
    period: '/month',
    tagline: 'Core cycle intelligence',
    features: [
      'Cycle tracking & phase predictions',
      'Phase-based tips & daily guidance',
      'Research-backed insights',
      'MoodMap visual guide',
      'Partner Profile',
      'Push notifications',
    ],
    excluded: ['AI Wingman'],
    paymentLink: process.env.REACT_APP_STRIPE_BASIC_LINK,
    accent: 'cyan',
  },
  {
    id: 'advanced',
    name: 'Advanced',
    price: '$19',
    period: '/month',
    tagline: 'Full access + AI-powered coaching',
    badge: 'Most Popular',
    features: [
      'Everything in Basic',
      'AI Wingman — personalized advice 24/7',
      'Real-time relationship guidance',
      'AI-driven phase recommendations',
    ],
    excluded: [],
    paymentLink: process.env.REACT_APP_STRIPE_ADVANCED_LINK,
    accent: 'emerald',
  },
];

const InfoPricing = () => {
  const navigate = useNavigate();

  const handleSelectPlan = (plan) => {
    const sessionToken = localStorage.getItem('session_token');
    const user = localStorage.getItem('user');

    if (sessionToken && user) {
      const userData = JSON.parse(user);
      if (plan.paymentLink && !plan.paymentLink.includes('PLACEHOLDER')) {
        const url = new URL(plan.paymentLink);
        url.searchParams.set('prefilled_email', userData.email);
        url.searchParams.set('client_reference_id', userData.id);
        window.location.href = url.toString();
      } else {
        toast.info('Payment links coming soon. Your trial is still active!');
      }
    } else {
      localStorage.setItem('pending_plan', plan.id);
      toast.info('Create your account first to start your free trial.');
      navigate('/signup');
    }
  };

  const handleStartTrial = () => {
    const sessionToken = localStorage.getItem('session_token');
    if (sessionToken) {
      navigate('/app');
    } else {
      navigate('/signup');
    }
  };

  return (
    <div className="min-h-screen">
      <InfoNav />

      {/* Hero */}
      <section className="relative pt-32 pb-12 px-6">
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-block bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-1.5 mb-6">
            <span className="text-cyan-400 text-sm font-semibold">7-Day Free Trial — Full Access</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight mb-6" data-testid="pricing-headline">
            Start Your 7-Day Trial and<br />Experience the Difference
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
            Every feature unlocked. No credit card required. See what it&apos;s like to actually understand her cycle.
          </p>
          <Button
            onClick={handleStartTrial}
            className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-6 text-lg font-semibold rounded-xl"
            data-testid="start-trial-btn"
          >
            Start Free Trial
          </Button>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-2">After Your Trial</h2>
          <p className="text-slate-400 text-center mb-10">Choose the plan that fits your game.</p>

          <div className="grid md:grid-cols-2 gap-8">
            {PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={`bg-slate-900/80 border-slate-700/50 flex flex-col relative ${
                  plan.accent === 'emerald'
                    ? 'ring-2 ring-emerald-500/50 border-emerald-500/30'
                    : 'ring-1 ring-slate-600/50'
                }`}
                data-testid={`plan-${plan.id}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                    {plan.badge}
                  </div>
                )}
                <CardHeader className="flex-1 pt-8">
                  <CardTitle className="text-white text-2xl font-bold">{plan.name}</CardTitle>
                  <p className="text-slate-400 text-sm mt-1">{plan.tagline}</p>
                  <div className="mt-5">
                    <span className="text-5xl font-bold text-white">{plan.price}</span>
                    <span className="text-slate-400 ml-1 text-lg">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1 flex flex-col">
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-slate-300 text-sm">
                        <svg className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                    {plan.excluded.map((f, i) => (
                      <li key={`ex-${i}`} className="flex items-start gap-2.5 text-slate-500 text-sm">
                        <svg className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="line-through">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full py-5 text-base font-semibold ${
                      plan.accent === 'emerald'
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
                    }`}
                    data-testid={`select-${plan.id}-btn`}
                  >
                    {plan.accent === 'emerald' ? 'Unlock AI-Guided Performance' : 'Get Started'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex flex-wrap justify-center gap-8 text-slate-500 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Secure Payment via Stripe</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>All Data Stays on Your Device</span>
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

      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-cyan-400 hover:text-cyan-300">Log In</Link>
          </p>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-slate-500 text-sm">&copy; {new Date().getFullYear()} Stars & Honey, LLC. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default InfoPricing;

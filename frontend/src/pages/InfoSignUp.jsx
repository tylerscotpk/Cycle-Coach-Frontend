import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import InfoNav from '@/components/InfoNav';

const API = process.env.REACT_APP_BACKEND_URL || "";

const PLAN_LINKS = {
  monthly: process.env.REACT_APP_STRIPE_MONTHLY_LINK,
  quarterly: process.env.REACT_APP_STRIPE_QUARTERLY_LINK,
  yearly: process.env.REACT_APP_STRIPE_ANNUAL_LINK,
};

const PLAN_NAMES = {
  monthly: 'Monthly Training Camp',
  quarterly: 'Quarter by Quarter',
  yearly: 'Full Season Strategy',
};

const InfoSignUp = () => {
  const navigate = useNavigate();
  const [pendingPlan, setPendingPlan] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const plan = localStorage.getItem('pending_plan');
    if (plan && PLAN_LINKS[plan]) {
      setPendingPlan(plan);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    
    if (!formData.email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    if (!formData.password) {
      toast.error('Please enter a password');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          password: formData.password,
          confirm_password: formData.confirmPassword
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        localStorage.setItem('session_token', result.session_token);
        localStorage.setItem('user', JSON.stringify(result.user));
        
        // Check for pending plan — redirect to Stripe checkout
        const plan = localStorage.getItem('pending_plan');
        if (plan && PLAN_LINKS[plan]) {
          localStorage.removeItem('pending_plan');
          toast.success('Account created! Redirecting to checkout...');
          const url = new URL(PLAN_LINKS[plan]);
          url.searchParams.set('prefilled_email', formData.email.trim());
          url.searchParams.set('client_reference_id', result.user.id);
          window.location.href = url.toString();
        } else {
          toast.success('Account created! Choose a plan to get started.');
          window.location.href = '/pricing';
        }
      } else {
        toast.error(result.detail || 'Failed to create account');
      }
    } catch (error) {
      console.error('Sign up error:', error);
      toast.error('Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <InfoNav />
      
      <section className="relative pt-32 pb-16 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-40 left-20 w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-md mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight mb-6 text-center" data-testid="signup-headline">
            Create Account
          </h1>

          {/* Pending plan banner */}
          {pendingPlan && (
            <div className="mb-6 bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 text-center" data-testid="pending-plan-banner">
              <p className="text-cyan-400 font-medium text-sm">
                Create your account to start your <span className="font-bold">{PLAN_NAMES[pendingPlan]}</span> plan.
              </p>
            </div>
          )}
          
          <Card className="bg-slate-900/80 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-white text-xl">Join Cycle Coach</CardTitle>
              <CardDescription className="text-slate-400">
                {pendingPlan
                  ? 'Create your account, then you\'ll be taken to secure checkout.'
                  : 'Create your account to get started with Cycle Coach.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp} className="space-y-5">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    required
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    data-testid="signup-email-input"
                  />
                </div>
                
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Phone <span className="text-slate-500">(optional)</span>
                  </label>
                  <Input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 123-4567"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    data-testid="signup-phone-input"
                  />
                </div>
                
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Password <span className="text-red-400">*</span>
                  </label>
                  <Input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="At least 6 characters"
                    required
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    data-testid="signup-password-input"
                  />
                </div>
                
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Confirm Password <span className="text-red-400">*</span>
                  </label>
                  <Input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    required
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    data-testid="signup-confirm-password-input"
                  />
                </div>
                
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-6 text-lg font-semibold"
                  data-testid="signup-submit-btn"
                >
                  {isLoading ? 'Creating Account...' : pendingPlan ? 'Create Account & Continue to Checkout' : 'Create Account'}
                </Button>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-700 text-center">
                <p className="text-slate-500 text-sm">
                  Already have an account?{' '}
                  <Link to="/login" className="text-cyan-400 hover:text-cyan-300" data-testid="login-link">
                    Log In
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-slate-800/50 mt-auto">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} Stars & Honey, LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default InfoSignUp;

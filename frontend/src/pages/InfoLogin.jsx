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

const InfoLogin = () => {
  const navigate = useNavigate();
  const [pendingPlan, setPendingPlan] = useState(null);
  const [formData, setFormData] = useState({
    emailOrPhone: '',
    password: '',
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

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!formData.emailOrPhone.trim()) {
      toast.error('Please enter your email or phone number');
      return;
    }
    if (!formData.password) {
      toast.error('Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_or_phone: formData.emailOrPhone.trim(),
          password: formData.password
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        localStorage.setItem('session_token', result.session_token);
        localStorage.setItem('user', JSON.stringify(result.user));
        
        // Check for pending plan first
        const plan = localStorage.getItem('pending_plan');
        if (plan && PLAN_LINKS[plan] && !result.user.has_subscription) {
          localStorage.removeItem('pending_plan');
          toast.success('Welcome back! Redirecting to checkout...');
          const url = new URL(PLAN_LINKS[plan]);
          url.searchParams.set('prefilled_email', result.user.email);
          window.location.href = url.toString();
          return;
        }

        localStorage.removeItem('pending_plan');

        // Route based on subscription
        if (result.user.has_subscription) {
          toast.success('Welcome back!');
          window.location.href = '/app';
        } else {
          toast.success('Welcome back! Choose a plan to get started.');
          window.location.href = '/pricing';
        }
      } else {
        toast.error(result.detail || 'Invalid email/phone or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <InfoNav />
      
      <section className="relative pt-32 pb-16 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-40 right-20 w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-md mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight mb-6 text-center" data-testid="login-headline">
            Log In
          </h1>

          {/* Pending plan banner */}
          {pendingPlan && (
            <div className="mb-6 bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 text-center" data-testid="pending-plan-banner">
              <p className="text-cyan-400 font-medium text-sm">
                Log in to continue to checkout.
              </p>
            </div>
          )}
          
          <Card className="bg-slate-900/80 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-white text-xl">Welcome Back</CardTitle>
              <CardDescription className="text-slate-400">
                Sign in to access your Cycle Coach dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Email or Phone
                  </label>
                  <Input
                    type="text"
                    name="emailOrPhone"
                    value={formData.emailOrPhone}
                    onChange={handleChange}
                    placeholder="your@email.com or phone number"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    data-testid="login-email-input"
                  />
                </div>
                
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Password
                  </label>
                  <Input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    data-testid="login-password-input"
                  />
                </div>
                
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-6 text-lg font-semibold"
                  data-testid="login-submit-btn"
                >
                  {isLoading ? 'Logging in...' : 'Log In'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link 
                  to="/forgot-password" 
                  className="text-cyan-400 hover:text-cyan-300 text-sm"
                  data-testid="forgot-password-link"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700 text-center">
                <p className="text-slate-500 text-sm">
                  Don't have an account?{' '}
                  <Link to="/signup" className="text-cyan-400 hover:text-cyan-300" data-testid="signup-link">
                    Sign Up
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

export default InfoLogin;

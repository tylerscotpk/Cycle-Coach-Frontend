import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import InfoNav from '@/components/InfoNav';

const API = process.env.REACT_APP_BACKEND_URL;

const InfoForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setSubmitted(true);
      } else {
        toast.error(result.detail || 'Failed to send reset link');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      toast.error('Failed to send reset link. Please try again.');
    } finally {
      setIsLoading(false);
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
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight mb-6 text-center" data-testid="forgot-password-headline">
            Reset Password
          </h1>
          
          <Card className="bg-slate-900/80 border-slate-700/50">
            {submitted ? (
              <CardContent className="py-12 text-center">
                <div className="text-5xl mb-6">✉️</div>
                <h2 className="text-2xl font-bold text-white mb-4">Check Your Email</h2>
                <p className="text-slate-400 mb-6">
                  If an account exists for {email}, we've sent a password reset link.
                </p>
                <p className="text-slate-500 text-sm mb-8">
                  The link will expire in 1 hour.
                </p>
                <Link to="/login">
                  <Button 
                    variant="outline" 
                    className="border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    Back to Login
                  </Button>
                </Link>
              </CardContent>
            ) : (
              <>
                <CardHeader>
                  <CardTitle className="text-white text-xl">Forgot Your Password?</CardTitle>
                  <CardDescription className="text-slate-400">
                    Enter your email and we'll send you a link to reset your password.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">
                        Email
                      </label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                        data-testid="forgot-email-input"
                      />
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-6 text-lg font-semibold"
                      data-testid="forgot-submit-btn"
                    >
                      {isLoading ? 'Sending...' : 'Send Reset Link'}
                    </Button>
                  </form>

                  {/* Back to Login Link */}
                  <div className="mt-6 text-center">
                    <Link 
                      to="/login" 
                      className="text-cyan-400 hover:text-cyan-300 text-sm"
                      data-testid="back-to-login-link"
                    >
                      ← Back to Login
                    </Link>
                  </div>
                </CardContent>
              </>
            )}
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

export default InfoForgotPassword;

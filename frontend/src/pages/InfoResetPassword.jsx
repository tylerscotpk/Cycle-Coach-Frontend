import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import InfoNav from '@/components/InfoNav';

const API = process.env.REACT_APP_BACKEND_URL || "";

const InfoResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error('Invalid reset link');
      navigate('/forgot-password');
    }
  }, [token, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.password) {
      toast.error('Please enter a new password');
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
      const response = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          new_password: formData.password
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setSuccess(true);
        toast.success('Password reset successfully!');
      } else {
        toast.error(result.detail || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      toast.error('Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <InfoNav />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-40 right-20 w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-md mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight mb-6 text-center" data-testid="reset-password-headline">
            Set New Password
          </h1>
          
          <Card className="bg-slate-900/80 border-slate-700/50">
            {success ? (
              <CardContent className="py-12 text-center">
                <div className="text-5xl mb-6">✓</div>
                <h2 className="text-2xl font-bold text-white mb-4">Password Reset!</h2>
                <p className="text-slate-400 mb-8">
                  Your password has been reset successfully. You can now log in with your new password.
                </p>
                <Link to="/login">
                  <Button className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-6 text-lg font-semibold">
                    Go to Login
                  </Button>
                </Link>
              </CardContent>
            ) : (
              <>
                <CardHeader>
                  <CardTitle className="text-white text-xl">Create New Password</CardTitle>
                  <CardDescription className="text-slate-400">
                    Enter your new password below.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">
                        New Password
                      </label>
                      <Input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="At least 6 characters"
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                        data-testid="reset-password-input"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">
                        Confirm New Password
                      </label>
                      <Input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="Confirm your password"
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                        data-testid="reset-confirm-password-input"
                      />
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-6 text-lg font-semibold"
                      data-testid="reset-submit-btn"
                    >
                      {isLoading ? 'Resetting...' : 'Reset Password'}
                    </Button>
                  </form>
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

export default InfoResetPassword;

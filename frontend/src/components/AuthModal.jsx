import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || "";

const AuthModal = ({ open, onOpenChange, defaultView = 'signup', onSuccess }) => {
  const [view, setView] = useState(defaultView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, confirm_password: confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registration failed');

      localStorage.setItem('session_token', data.session_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      toast.success('Account created! Check your email to verify.');
      onOpenChange(false);
      resetForm();
      if (onSuccess) onSuccess({ type: 'signup', user: data.user, needsVerification: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_or_phone: email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');

      localStorage.setItem('session_token', data.session_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      toast.success('Logged in!');
      onOpenChange(false);
      resetForm();
      if (onSuccess) onSuccess({ type: 'login', user: data.user, needsVerification: !data.user.email_verified });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md" data-testid="auth-modal">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">
            {view === 'signup' ? 'Create Your Account' : 'Welcome Back'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {view === 'signup'
              ? 'Sign up to start your Cycle Coach experience'
              : 'Log in to your Cycle Coach account'}
          </DialogDescription>
        </DialogHeader>

        {view === 'signup' ? (
          <form onSubmit={handleSignUp} className="space-y-4 mt-2">
            <div>
              <Label className="text-slate-300 text-sm">Email</Label>
              <Input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com" required
                className="bg-slate-700/50 border-slate-600 text-white mt-1"
                data-testid="modal-signup-email"
              />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Password</Label>
              <Input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters" required minLength={6}
                className="bg-slate-700/50 border-slate-600 text-white mt-1"
                data-testid="modal-signup-password"
              />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Confirm Password</Label>
              <Input
                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password" required
                className="bg-slate-700/50 border-slate-600 text-white mt-1"
                data-testid="modal-signup-confirm"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-5"
              data-testid="modal-signup-submit">
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
            <p className="text-center text-slate-400 text-sm">
              Already have an account?{' '}
              <button type="button" onClick={() => setView('login')} className="text-cyan-400 hover:text-cyan-300 font-medium">
                Log In
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4 mt-2">
            <div>
              <Label className="text-slate-300 text-sm">Email or Phone</Label>
              <Input
                type="text" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com" required
                className="bg-slate-700/50 border-slate-600 text-white mt-1"
                data-testid="modal-login-email"
              />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Password</Label>
              <Input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password" required
                className="bg-slate-700/50 border-slate-600 text-white mt-1"
                data-testid="modal-login-password"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-5"
              data-testid="modal-login-submit">
              {loading ? 'Logging in...' : 'Log In'}
            </Button>
            <div className="flex justify-between text-sm">
              <button type="button" onClick={() => setView('signup')} className="text-cyan-400 hover:text-cyan-300 font-medium">
                Create Account
              </button>
              <a href="/forgot-password" className="text-slate-400 hover:text-slate-300">
                Forgot password?
              </a>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;

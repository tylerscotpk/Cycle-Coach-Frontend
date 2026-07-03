import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || "";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying | success | error | waiting
  const [resending, setResending] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      verifyToken(token);
    } else {
      setStatus('waiting');
    }
  }, [token]);

  const verifyToken = async (t) => {
    try {
      const res = await fetch(`${API}/api/auth/verify-email?token=${t}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('success');
        // Update local user data
        try {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          user.email_verified = true;
          localStorage.setItem('user', JSON.stringify(user));
        } catch {}
        toast.success('Email verified!');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const email = user.email;
      if (!email) {
        toast.error('No email found. Please log in again.');
        return;
      }
      const res = await fetch(`${API}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        toast.success('Verification email sent! Check your inbox.');
      } else {
        toast.error('Failed to resend. Try again.');
      }
    } catch {
      toast.error('Failed to resend.');
    } finally {
      setResending(false);
    }
  };

  const handleContinue = () => {
    const pendingPlan = localStorage.getItem('pending_plan');
    if (pendingPlan) {
      navigate('/pricing');
    } else {
      navigate('/pricing');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {status === 'verifying' && (
          <>
            <div className="text-5xl mb-4">📧</div>
            <h1 className="text-2xl font-bold text-white">Verifying your email...</h1>
            <p className="text-slate-400">Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-white">Email Verified!</h1>
            <p className="text-slate-400">Your account is confirmed. Let&apos;s get you started.</p>
            <Button
              onClick={handleContinue}
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-5 text-lg"
              data-testid="verify-continue-btn"
            >
              Continue to Choose Your Plan
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-white">Verification Failed</h1>
            <p className="text-slate-400">The link may have expired or already been used.</p>
            <div className="flex flex-col gap-3">
              <Button onClick={handleResend} disabled={resending}
                className="bg-cyan-500 hover:bg-cyan-600 text-white">
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </Button>
              <Button variant="outline" className="border-slate-600 text-slate-300"
                onClick={() => navigate('/login')}>
                Back to Log In
              </Button>
            </div>
          </>
        )}

        {status === 'waiting' && (
          <>
            <div className="text-5xl mb-4">📧</div>
            <h1 className="text-2xl font-bold text-white">Please Verify Your Email</h1>
            <p className="text-slate-400">
              We&apos;ve sent a verification link to your email. Click it to activate your account and continue.
            </p>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 mt-4">
              <p className="text-slate-300 text-sm">
                Didn&apos;t get the email? Check your spam folder, or:
              </p>
              <Button onClick={handleResend} disabled={resending} variant="outline"
                className="mt-3 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
                data-testid="resend-verification-btn">
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;

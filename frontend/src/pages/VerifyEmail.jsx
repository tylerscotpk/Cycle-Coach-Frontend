import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || "";

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isCapacitor = () => typeof window !== 'undefined' && !!window.Capacitor;

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const [resending, setResending] = useState(false);
  const hasVerified = useRef(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (token && !hasVerified.current) {
      hasVerified.current = true;
      verifyToken(token);
    } else if (!token) {
      setStatus('waiting');
    }
  }, [token]);

  const verifyToken = async (t) => {
    try {
      const res = await fetch(`${API}/api/auth/verify-email?token=${t}`);
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (res.ok && data.success) {
        setStatus('success');
        try {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          user.email_verified = true;
          localStorage.setItem('user', JSON.stringify(user));
        } catch { /* ignore */ }
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

  const handleReturnToApp = () => {
    if (isCapacitor()) {
      // Already inside the Capacitor app — navigate normally
      navigate('/pricing');
      return;
    }

    if (isIOS()) {
      // On iOS Safari — deep link back into the Capacitor app
      window.location.href = 'cyclecoach://verified';
      // Fallback: if deep link doesn't open (app not installed), show web flow after delay
      setTimeout(() => {
        navigate('/pricing');
      }, 1500);
      return;
    }

    // Web and Android — navigate normally
    navigate('/pricing');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {status === 'verifying' && (
          <>
            <div className="text-5xl mb-4">
              <svg className="w-12 h-12 mx-auto text-cyan-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Verifying your email...</h1>
            <p className="text-slate-400">Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8">
              <div className="text-5xl mb-4">
                <svg className="w-16 h-16 mx-auto text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Email Verified Successfully</h1>
              <p className="text-slate-400 mb-6">Your account is confirmed and ready to go.</p>
              <Button
                onClick={handleReturnToApp}
                className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-5 text-lg w-full"
                data-testid="verify-return-btn"
              >
                {isIOS() && !isCapacitor() ? 'Return to Cycle Coach' : 'Continue to Choose Your Plan'}
              </Button>
              {isIOS() && !isCapacitor() && (
                <p className="text-slate-500 text-xs mt-3">
                  This will open the Cycle Coach app. If the app doesn&apos;t open, you can log in from the app directly.
                </p>
              )}
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">
              <svg className="w-16 h-16 mx-auto text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Verification Failed</h1>
            <p className="text-slate-400">The link may have expired or already been used.</p>
            <div className="flex flex-col gap-3">
              <Button onClick={handleResend} disabled={resending}
                className="bg-cyan-500 hover:bg-cyan-600 text-white"
                data-testid="error-resend-btn">
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </Button>
              <Button variant="outline" className="border-slate-600 text-slate-300"
                onClick={() => navigate('/login')}
                data-testid="error-back-login-btn">
                Back to Log In
              </Button>
            </div>
          </>
        )}

        {status === 'waiting' && (
          <>
            <div className="text-5xl mb-4">
              <svg className="w-16 h-16 mx-auto text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
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

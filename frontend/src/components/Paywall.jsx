import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Simplified Paywall - redirects to login/signup flow
const Paywall = ({ onUnlock }) => {
  useEffect(() => {
    // Redirect to pricing page - the new auth flow handles everything
    window.location.href = '/pricing';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-white text-xl">Redirecting...</div>
    </div>
  );
};

export default Paywall;

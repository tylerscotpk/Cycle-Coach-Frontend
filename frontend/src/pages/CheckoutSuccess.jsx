import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CYCLE_COACH_ICON = "https://customer-assets.emergentagent.com/job_partner-cycle/artifacts/mdtjfodq_Cycle%20Coach%20Circle%20Icon.png";

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/app');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6" data-testid="checkout-success-page">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-cyan-600/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-slate-700/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-lg w-full text-center space-y-8">
        <div className="flex justify-center">
          <img src={CYCLE_COACH_ICON} alt="Cycle Coach" className="w-20 h-20 object-contain" />
        </div>

        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight" data-testid="checkout-success-title">
            You're In!
          </h1>
          <p className="text-slate-400 text-lg">
            Your subscription is active. Welcome to Cycle Coach.
          </p>
        </div>

        <Button
          onClick={() => navigate('/app')}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 text-base rounded-full"
          data-testid="go-to-app-btn"
        >
          Go to the App
        </Button>

        <p className="text-slate-500 text-sm">
          Redirecting in {countdown}s...
        </p>
      </div>
    </div>
  );
}

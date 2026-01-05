import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LocalStorage } from '../utils/localStorageManager';

// Valid license keys (in production, this would be validated server-side)
const VALID_LICENSE_KEYS = [
  'CYCLE-COACH-2024-ALPHA',
  'CYCLE-COACH-2024-BETA',
  'CYCLE-COACH-LAUNCH-001',
  'CYCLE-COACH-LAUNCH-002',
  'CYCLE-COACH-LAUNCH-003',
  'CC-EARLY-ACCESS-001',
  'CC-EARLY-ACCESS-002',
  'CC-FOUNDER-SPECIAL'
];

const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/test_7sY28t65k9Q18VS5dienS00';

const Paywall = ({ onUnlock }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleValidateLicense = (e) => {
    e.preventDefault();
    setIsValidating(true);

    // Simulate validation delay
    setTimeout(() => {
      const normalizedKey = licenseKey.trim().toUpperCase();
      
      if (VALID_LICENSE_KEYS.includes(normalizedKey)) {
        LocalStorage.saveLicenseKey(normalizedKey);
        toast.success('License activated! Welcome to Cycle Coach.');
        onUnlock();
      } else {
        toast.error('Invalid license key. Please check and try again.');
      }
      setIsValidating(false);
    }, 800);
  };

  const handleBuyNow = () => {
    window.open(STRIPE_PAYMENT_LINK, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Cycle Coach</h1>
          <p className="text-slate-400">Your relationship game-changer</p>
        </div>

        {/* Main Card */}
        <Card className="bg-slate-800/90 backdrop-blur-sm border-slate-700">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl text-white">Unlock Full Access</CardTitle>
            <CardDescription className="text-slate-400">
              Get lifetime access to all features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Features List */}
            <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
              <h4 className="text-white font-semibold text-sm uppercase tracking-wide">What you get:</h4>
              <ul className="space-y-2 text-slate-300 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-cyan-400">✓</span>
                  Cycle tracking & phase predictions
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-cyan-400">✓</span>
                  AI Wingman for personalized advice
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-cyan-400">✓</span>
                  MoodMap visualization
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-cyan-400">✓</span>
                  Partner preferences tracker
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-cyan-400">✓</span>
                  Phase-matched resources & tips
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-cyan-400">✓</span>
                  100% privacy - data stays on your device
                </li>
              </ul>
            </div>

            {/* Buy Button */}
            <Button
              onClick={handleBuyNow}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-6 text-lg font-semibold"
              data-testid="buy-now-button"
            >
              Get Lifetime Access
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-600"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-800 px-2 text-slate-500">Already purchased?</span>
              </div>
            </div>

            {/* License Key Input */}
            <form onSubmit={handleValidateLicense} className="space-y-4">
              <div>
                <Label htmlFor="license-key" className="text-slate-300 text-sm">
                  Enter your license key
                </Label>
                <Input
                  id="license-key"
                  data-testid="license-key-input"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="CYCLE-COACH-XXXX-XXXX"
                  className="bg-slate-700/50 border-slate-600 text-white mt-2 uppercase"
                  required
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                disabled={isValidating || !licenseKey.trim()}
                data-testid="activate-license-button"
              >
                {isValidating ? 'Validating...' : 'Activate License'}
              </Button>
            </form>

            <p className="text-xs text-slate-500 text-center">
              After purchase, you will receive your license key via email.
              Check your spam folder if you do not see it.
            </p>
          </CardContent>
        </Card>

        {/* Privacy Note */}
        <div className="text-center">
          <p className="text-xs text-slate-500">
            🔒 Your data stays on your device. No account required.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Paywall;

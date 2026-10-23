import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccountDeleted() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" data-testid="account-deleted-page">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-bold text-white" data-testid="account-deleted-title">Your account has been deleted</h1>
        <p className="text-slate-400">
          Your Cycle Coach account, its server records and all data stored on this device have been permanently removed.
          Any active subscription was cancelled and you will not be charged again.
        </p>
        <Button onClick={() => window.location.replace('/')} className="bg-cyan-600 hover:bg-cyan-500 text-white px-8" data-testid="account-deleted-home-btn">
          Return to Home
        </Button>
      </div>
    </div>
  );
}

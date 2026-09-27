import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const UpgradeModal = ({ open, onOpenChange, onUpgrade, upgrading }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg" data-testid="upgrade-modal">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Upgrade to Advanced</DialogTitle>
          <DialogDescription className="text-slate-400">Unlock AI-powered relationship coaching</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <p className="text-slate-400 text-sm">Advanced adds:</p>
          {['AI Wingman — personalized advice 24/7', 'Real-time relationship guidance', 'AI-driven phase recommendations', 'Personalized tips based on your data'].map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-emerald-300 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {f}
            </div>
          ))}
          <div className="bg-slate-700/50 rounded-lg p-4 mt-4">
            <p className="text-white font-semibold">Advanced — $8/month</p>
            <p className="text-slate-400 text-xs mt-1">You&apos;ll be redirected to Stripe to complete payment.</p>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <Button onClick={onUpgrade} disabled={upgrading}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white" data-testid="confirm-upgrade-btn">
            {upgrading ? 'Redirecting to Stripe...' : 'Upgrade Now — $8/mo'}
          </Button>
          <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const API = process.env.REACT_APP_BACKEND_URL || "";

export const UndoCancellationSection = ({ subscription, tierName, formatDate, onRestored }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isLifetime = ['grandfathered', 'lifetime'].includes(subscription?.plan_type) ||
    ['grandfathered', 'lifetime'].includes(subscription?.subscription_tier);
  const cancelsAt = subscription?.cancels_at ? new Date(subscription.cancels_at) : null;
  const eligible = subscription?.subscription_status === 'cancelling' && subscription?.stripe_subscription_id &&
    !isLifetime && cancelsAt && cancelsAt > new Date();
  if (!eligible) return null;

  const handleUndo = async () => {
    setBusy(true);
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`${API}/api/account/undo-cancellation`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      let data; try { data = await res.json(); } catch { data = {}; }
      if (!res.ok || !data.success) throw new Error(data.detail || 'Could not restore your subscription.');
      setOpen(false);
      toast.success(`Cancellation undone. Your ${tierName} plan will renew automatically.`);
      onRestored();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-4 border-t border-slate-700" data-testid="undo-cancellation-section">
      <Button onClick={() => setOpen(true)} className="bg-cyan-500 hover:bg-cyan-600 text-white" data-testid="undo-cancellation-btn">
        Undo Cancellation
      </Button>
      <p className="text-slate-500 text-xs mt-2">Keep your {tierName} plan and resume automatic renewal.</p>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="bg-slate-800 border-slate-700" data-testid="undo-cancellation-modal">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-xl">Resume your {tierName} subscription?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-slate-300 space-y-3 text-sm">
                <p>Your subscription is currently set to end on <span className="text-orange-400">{formatDate(subscription.cancels_at)}</span>.</p>
                <ul className="bg-slate-900/50 rounded-lg p-4 space-y-1">
                  <li>• You will not be charged today.</li>
                  <li>• Your plan renews at its current price on {formatDate(subscription.cancels_at)}.</li>
                  <li>• You can cancel again anytime before then.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="bg-slate-700 text-white border-slate-600 hover:bg-slate-600" disabled={busy} data-testid="undo-cancellation-dismiss-btn">
              Not Now
            </AlertDialogCancel>
            <Button onClick={handleUndo} disabled={busy} className="bg-cyan-500 hover:bg-cyan-600 text-white" data-testid="undo-cancellation-confirm-btn">
              {busy ? 'Restoring…' : 'Yes, Keep My Subscription'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

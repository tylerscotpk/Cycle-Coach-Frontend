import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { LocalStorage } from '@/utils/localStorageManager';
import { cancelAllScheduled } from '@/utils/notificationService';

const API = process.env.REACT_APP_BACKEND_URL || "";

const billingNotice = (sub) => {
  const status = sub?.subscription_status;
  const lifetime = ['grandfathered', 'lifetime'].includes(sub?.plan_type) || ['grandfathered', 'lifetime'].includes(sub?.subscription_tier);
  if (lifetime) return 'Your Lifetime access will end permanently. Lifetime access cannot be restored after deletion.';
  if (status === 'trialing' || sub?.plan_type === 'trial') return 'Your free trial will be cancelled immediately. You will not be charged.';
  if (['active', 'cancelling', 'past_due'].includes(status)) return 'Your subscription will be cancelled immediately so you are never charged again, and the unused part of your current billing period will be refunded to your original payment method (typically 5–10 business days).';
  return 'You have no active subscription, so there is nothing to cancel or refund.';
};

export const DeleteAccountSection = ({ subscription }) => {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finish = async () => {
    const uid = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').id; } catch { return null; } })();
    await cancelAllScheduled();
    LocalStorage.deleteAllUserData(uid);
    window.location.replace('/account-deleted');
  };

  const handleDelete = async () => {
    setBusy(true);
    setError('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`${API}/api/account/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password, confirmation: confirmText }),
      });
      let data; try { data = await res.json(); } catch { data = {}; }
      if ((res.ok && data.success) || res.status === 404) { await finish(); return; }
      setError(data.detail || 'Your account could not be deleted. Please try again.');
    } catch {
      setError('Network error — your account was not deleted. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = password.length > 0 && confirmText.trim().toUpperCase() === 'DELETE' && !busy;

  return (
    <Card className="bg-slate-800/50 border-red-900/60" data-testid="delete-account-section">
      <CardHeader>
        <CardTitle className="text-red-400">Delete Account</CardTitle>
        <CardDescription className="text-slate-400">Permanently delete your Cycle Coach account and all of its data.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => { setOpen(true); setError(''); }} className="bg-red-600 hover:bg-red-700 text-white" data-testid="delete-account-btn">
          <Trash2 className="w-4 h-4 mr-2" /> Delete Account
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md max-h-[90vh] overflow-y-auto" data-testid="delete-account-modal">
          <DialogHeader>
            <DialogTitle className="text-xl text-red-400">Permanently delete your account?</DialogTitle>
            <DialogDescription className="text-slate-300">This cannot be undone.</DialogDescription>
          </DialogHeader>
          <ul className="text-sm text-slate-300 space-y-2 bg-slate-900/60 rounded-lg p-4">
            <li>• Your login, profile and account records are deleted from our servers.</li>
            <li>• All cycle, partner and history data stored on this device is erased.</li>
            <li>• You are signed out everywhere.</li>
            <li data-testid="delete-billing-notice">• {billingNotice(subscription)}</li>
            <li className="text-slate-500">• Payment transaction records are kept by Stripe only as required by law.</li>
          </ul>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-slate-300 block mb-1" htmlFor="delete-password">Enter your password</label>
              <Input id="delete-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white" autoComplete="current-password" data-testid="delete-password-input" />
            </div>
            <div>
              <label className="text-sm text-slate-300 block mb-1" htmlFor="delete-confirm">Type DELETE to confirm</label>
              <Input id="delete-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoCapitalize="characters"
                className="bg-slate-900 border-slate-700 text-white" data-testid="delete-confirm-input" />
            </div>
            {error && <p className="text-red-400 text-sm" data-testid="delete-account-error">{error}</p>}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy} className="flex-1 border-slate-600 text-slate-200 bg-transparent" data-testid="delete-cancel-btn">
              Keep My Account
            </Button>
            <Button onClick={handleDelete} disabled={!canSubmit} className="flex-1 bg-red-600 hover:bg-red-700 text-white" data-testid="delete-confirm-btn">
              {busy ? 'Deleting…' : 'Delete Permanently'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

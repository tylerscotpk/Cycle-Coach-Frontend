import { useEffect, useState, useCallback } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CHECKOUT_EVENT } from '@/utils/checkout';

const API = process.env.REACT_APP_BACKEND_URL || "";

// Checks Stripe (via sync) then auth; returns true once the account has an active plan
export const confirmSubscriptionActive = async () => {
  const token = localStorage.getItem('session_token');
  if (!token) return false;
  const headers = { Authorization: `Bearer ${token}` };
  try { await fetch(`${API}/api/subscription/sync`, { method: 'POST', headers }); } catch { /* best effort */ }
  const res = await fetch(`${API}/api/auth/check`, { headers });
  const data = await res.json();
  if (data.authenticated) localStorage.setItem('user', JSON.stringify(data.user));
  return !!data.has_subscription && !!data.user?.plan_type && !['none', 'expired'].includes(data.user.plan_type);
};

export const ExternalCheckoutDialog = () => {
  const [url, setUrl] = useState(null);
  const [opened, setOpened] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notYet, setNotYet] = useState(false);

  useEffect(() => {
    const onOpen = (e) => { setUrl(e.detail.url); setOpened(false); setNotYet(false); };
    window.addEventListener(CHECKOUT_EVENT, onOpen);
    return () => window.removeEventListener(CHECKOUT_EVENT, onOpen);
  }, []);

  const check = useCallback(async () => {
    setChecking(true);
    setNotYet(false);
    try {
      if (await confirmSubscriptionActive()) { window.location.href = '/app'; return; }
      setNotYet(true);
    } catch { setNotYet(true); } finally { setChecking(false); }
  }, []);

  useEffect(() => {
    if (!url || !opened) return;
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [url, opened, check]);

  return (
    <Dialog open={!!url} onOpenChange={(o) => { if (!o) setUrl(null); }}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md" data-testid="external-checkout-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">Continue to Secure Checkout</DialogTitle>
          <DialogDescription className="text-slate-300">
            Payment is completed on Stripe&apos;s secure checkout page in Safari. When you&apos;re done, return to Cycle Coach and your plan activates automatically.
          </DialogDescription>
        </DialogHeader>
        <a href={url || '#'} onClick={() => setOpened(true)} data-testid="external-checkout-open-link"
          className="flex items-center justify-center gap-2 w-full rounded-md bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 transition-colors">
          Open Checkout in Safari <ExternalLink className="w-4 h-4" />
        </a>
        {opened && (
          <Button onClick={check} disabled={checking} variant="outline" data-testid="external-checkout-done-btn"
            className="w-full border-slate-600 text-slate-200 bg-transparent">
            {checking ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking your plan…</> : "I've completed payment"}
          </Button>
        )}
        {notYet && (
          <p className="text-amber-300 text-sm" data-testid="external-checkout-not-yet">
            We haven&apos;t received confirmation yet. It can take up to a minute — tap the button again shortly.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

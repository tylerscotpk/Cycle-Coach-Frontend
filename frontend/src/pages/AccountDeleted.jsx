import { useState } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const money = (cents, currency) =>
  typeof cents === 'number'
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(cents / 100)
    : 'the unused amount';

const readResult = () => {
  try { return JSON.parse(sessionStorage.getItem('cc_deletion_result') || '{}'); } catch { return {}; }
};

const RefundLine = ({ r }) => {
  if (r.state === 'issued') {
    return <li data-testid="refund-status-refunded">Refund of {money(r.amount, r.currency)} issued to your original payment method (allow 5–10 business days). Reference: {r.reference}</li>;
  }
  if (r.state === 'pending') {
    return <li data-testid="refund-status-processing">Refund of {money(r.amount, r.currency)} submitted — Stripe is still processing it. Reference: {r.reference}</li>;
  }
  if (r.state === 'needs_attention') {
    return (
      <li className="text-amber-300" data-testid="refund-status-pending">
        <AlertTriangle className="inline w-4 h-4 mr-1" />
        Your refund of {money(r.amount, r.currency)} couldn&apos;t be processed automatically. Our team has been notified and will issue it.
        Reference: <strong>{r.reference}</strong> — contact cyclecoach4men@gmail.com with this reference if you have questions.
      </li>
    );
  }
  return null;
};

export default function AccountDeleted() {
  const [result] = useState(readResult);
  const refunds = (result.refunds || []).filter((r) => ['issued', 'pending', 'needs_attention'].includes(r.state));

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
        {result.confirmationEmail && (
          <p className="text-slate-400 text-sm" data-testid="deletion-email-note">A confirmation email is on its way to your verified email address.</p>
        )}
        {refunds.length > 0 && (
          <ul className="text-left text-sm text-slate-300 bg-slate-900/60 rounded-lg p-4 space-y-2" data-testid="refund-status-list">
            {refunds.map((r) => <RefundLine key={r.reference} r={r} />)}
          </ul>
        )}
        <Button onClick={() => { sessionStorage.removeItem('cc_deletion_result'); window.location.replace('/'); }}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-8" data-testid="account-deleted-home-btn">
          Return to Home
        </Button>
      </div>
    </div>
  );
}

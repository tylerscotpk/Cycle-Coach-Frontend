import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || "";
const money = (c, cur) => (typeof c === 'number' ? `${(c / 100).toFixed(2)} ${(cur || 'usd').toUpperCase()}` : 'unknown');

export const DeletionRefundsPanel = ({ headers }) => {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try {
      const res = await fetch(`${API}/api/admin/deletion-refunds?status=open`, { headers: headers() });
      if (res.ok) setRows(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const checkPending = async () => {
    setBusy('check');
    try {
      const res = await fetch(`${API}/api/admin/deletion-refunds/check-pending`, { method: 'POST', headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Check failed');
      const sent = (data.results || []).filter((r) => r.followup_sent).length;
      toast.success(`Checked ${data.results.length} refund(s); ${sent} follow-up email(s) sent`);
      load();
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };

  const act = async (ref, action) => {
    setBusy(ref);
    try {
      const res = await fetch(`${API}/api/admin/deletion-refunds/${ref}/${action}`, { method: 'POST', headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Action failed');
      toast.success(action === 'retry' ? `Retry finished: ${data.status || 'recalculated'}` : 'Marked resolved');
      load();
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <Card className="border-slate-700 bg-slate-800/50" data-testid="deletion-refunds-panel">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-white text-lg">Open Deletion Refunds ({rows.length})</CardTitle>
        <Button size="sm" variant="outline" disabled={busy === 'check'} onClick={checkPending} className="border-slate-600 text-slate-300" data-testid="deletion-refunds-check-pending-btn">
          {busy === 'check' ? 'Checking…' : 'Check Pending with Stripe'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && <p className="text-slate-400 text-sm" data-testid="deletion-refunds-empty">None — all deletion refunds were processed.</p>}
        {rows.map((r) => (
          <div key={r.reference} className="bg-slate-900/60 rounded-lg p-3 text-sm text-slate-300 flex flex-wrap items-center gap-3 justify-between" data-testid={`deletion-refund-${r.reference}`}>
            <div>
              <p className="text-white font-medium">{r.reference} · {money(r.unused_amount, r.currency)} · <span className={r.status === 'needs_attention' ? 'text-amber-400' : 'text-cyan-400'}>{r.status === 'needs_attention' ? 'Needs attention' : 'Pending at Stripe'}</span></p>
              <p className="text-slate-500 text-xs">Customer {r.stripe_customer_id} · Invoice {r.invoice_id || '—'} · {r.error}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy === r.reference} onClick={() => act(r.reference, 'retry')} className="bg-cyan-600 hover:bg-cyan-500 text-white" data-testid={`deletion-refund-retry-${r.reference}`}>Retry</Button>
              <Button size="sm" variant="outline" disabled={busy === r.reference} onClick={() => act(r.reference, 'mark-resolved')} className="border-slate-600 text-slate-300" data-testid={`deletion-refund-resolve-${r.reference}`}>Mark Resolved</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

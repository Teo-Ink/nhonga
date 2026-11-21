'use client';
import { useEffect, useState } from 'react';
import { formatPrice } from '../../lib/format';
import { useDict } from '../i18n/DictProvider';
import type { CheckoutView } from './PaymentStatus';

// Dev-only stand-in for the PawaPay / PaySuite hosted page.
export function PaymentSimulator({ id }: { id: string }) {
  const t = useDict().pay;
  const [p, setP] = useState<CheckoutView | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/checkout/${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<CheckoutView>) : null))
      .then(setP)
      .catch(() => setP(null));
  }, [id]);

  async function decide(outcome: 'paid' | 'failed') {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/checkout/mock/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ outcome }),
    });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { detail?: string };
      setErr(d.detail ?? 'Erro');
      setBusy(false);
      return;
    }
    window.location.assign(`/pagamento/${id}`);
  }

  return (
    <div className="paystatus paystatus--sim">
      <span className="paystatus__tag">DEV</span>
      <h1 className="paystatus__title">{t.sim_title}</h1>
      <p className="paystatus__body">{t.sim_body}</p>
      {p ? <p className="paystatus__amount">{formatPrice(p.amountCents)}</p> : null}
      {err ? <p className="paystatus__err">{err}</p> : null}
      <div className="paystatus__actions">
        <button
          type="button"
          className="btn btn--cta"
          disabled={busy || !p}
          onClick={() => void decide('paid')}
        >
          {t.sim_approve}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy || !p}
          onClick={() => void decide('failed')}
        >
          {t.sim_decline}
        </button>
      </div>
    </div>
  );
}

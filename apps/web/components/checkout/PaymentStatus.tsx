'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '../../lib/format';
import { useDict } from '../i18n/DictProvider';

export interface CheckoutView {
  id: string;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'review';
  amountCents: number;
  method: string;
  gateway: string;
  checkoutUrl: string | null;
  failureReason: string | null;
}

const METHOD_LABEL: Record<string, string> = {
  mpesa: 'M-Pesa',
  emola: 'e-Mola',
  card: 'Visa',
};

const POLL_MS = 3000;
const MAX_POLL_MS = 20 * 60_000;

// Where the gateway sends the seller back. Polls the API (which re-reads the
// gateway) until the payment settles, so it works even if the webhook is late.
export function PaymentStatus({ id }: { id: string }) {
  const t = useDict().pay;
  const [p, setP] = useState<CheckoutView | null>(null);
  const [missing, setMissing] = useState(false);
  const started = useRef(Date.now());

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const res = await fetch(`/api/checkout/${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (res.status === 404 || res.status === 401) {
          setMissing(true);
          return;
        }
        if (res.ok) {
          const d = (await res.json()) as CheckoutView;
          if (stop) return;
          setP(d);
          if (d.status !== 'pending') return;
        }
      } catch {
        /* network blip: keep polling */
      }
      if (!stop && Date.now() - started.current < MAX_POLL_MS)
        timer = setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  if (missing) {
    return (
      <div className="paystatus paystatus--failed" role="status">
        <h1 className="paystatus__title">{t.not_found}</h1>
        <Link className="btn btn--primary" href="/vender">
          {t.back_wallet}
        </Link>
      </div>
    );
  }

  const status = p?.status ?? 'pending';
  const copy = {
    pending: [t.pending_title, t.pending_body],
    paid: [t.paid_title, t.paid_body],
    failed: [t.failed_title, t.failed_body],
    expired: [t.expired_title, t.expired_body],
    review: [t.review_title, t.review_body],
  }[status];

  return (
    <div className={`paystatus paystatus--${status}`} role="status" aria-live="polite">
      <div className="paystatus__icon" aria-hidden="true">
        {status === 'pending' ? (
          <span className="paystatus__spinner" />
        ) : status === 'paid' ? (
          '✓'
        ) : status === 'review' ? (
          '!'
        ) : (
          '×'
        )}
      </div>
      <h1 className="paystatus__title">{copy[0]}</h1>
      <p className="paystatus__body">{copy[1]}</p>

      {p ? (
        <dl className="paystatus__facts">
          <div>
            <dt>{t.amount}</dt>
            <dd>{formatPrice(p.amountCents)}</dd>
          </div>
          <div>
            <dt>{t.method}</dt>
            <dd>{METHOD_LABEL[p.method] ?? p.method}</dd>
          </div>
          <div>
            <dt>{t.reference}</dt>
            <dd className="paystatus__ref">{p.id.slice(0, 8).toUpperCase()}</dd>
          </div>
        </dl>
      ) : null}

      <div className="paystatus__actions">
        {status === 'pending' && p?.checkoutUrl ? (
          <a className="btn btn--ghost" href={p.checkoutUrl}>
            {t.reopen}
          </a>
        ) : null}
        {status === 'failed' || status === 'expired' ? (
          <Link className="btn btn--cta" href="/vender?carregar=1">
            {t.try_again}
          </Link>
        ) : null}
        <Link className={`btn ${status === 'paid' ? 'btn--cta' : 'btn--ghost'}`} href="/vender">
          {t.back_wallet}
        </Link>
      </div>
    </div>
  );
}

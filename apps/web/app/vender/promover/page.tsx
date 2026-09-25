'use client';
import { useEffect, useState } from 'react';
import { cents, formatMZN } from '@nhonga/shared';
import { pt } from '../../../lib/i18n/pt';
import { IconChevronLeft, IconCheck } from '../../../components/icons';
import type { ProductListItem } from '../../../lib/api';

interface Plan {
  code: string;
  name: string;
  kind: 'feature' | 'bump';
  priceCents: number;
  durationDays: number;
}
interface Receipt {
  productTitle: string;
  planName: string;
  amountCents: number;
  paymentMethod: string;
  endsAt: string | null;
}
const METHODS = [
  { id: 'mpesa', label: 'M-Pesa' },
  { id: 'emola', label: 'e-Mola' },
  { id: 'mkesh', label: 'mKesh' },
];

// Buy a promotion for a listing (paid visibility, E). Payment is a labelled
// mock — no real charge — consistent with the rest of the demo.
export default function PromotePage() {
  const t = pt.promote;
  const [listings, setListings] = useState<ProductListItem[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [slug, setSlug] = useState('');
  const [planCode, setPlanCode] = useState('');
  const [method, setMethod] = useState('mpesa');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    void fetch('/api/listings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { items: ProductListItem[] }) => setListings(d.items ?? []))
      .catch(() => setListings([]));
    void fetch('/api/promotions/plans', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: Plan[]) => {
        setPlans(d);
        if (d[0]) setPlanCode(d[0].code);
      })
      .catch(() => setPlans([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!slug || !planCode) {
      setError(t.pick_all);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productSlug: slug, planCode, paymentMethod: method }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        receipt?: Receipt;
        message?: string;
      };
      if (!res.ok || !data.receipt) {
        setError(data.message ?? t.error);
        return;
      }
      setReceipt(data.receipt);
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <section className="promote">
        <div className="confirm__hero">
          <span className="confirm__check" aria-hidden="true">
            <IconCheck width={26} height={26} />
          </span>
          <h1 className="section__title">{t.done_title}</h1>
          <p className="account__muted">{t.done_body}</p>
        </div>
        <div className="card">
          <ul className="reviewlist">
            <li>
              <span>{t.f_listing}</span>
              <strong>{receipt.productTitle}</strong>
            </li>
            <li>
              <span>{t.f_plan}</span>
              <strong>{receipt.planName}</strong>
            </li>
            <li>
              <span>{t.f_amount}</span>
              <strong>{formatMZN(cents(receipt.amountCents))}</strong>
            </li>
            <li>
              <span>{t.f_method}</span>
              <strong>
                {METHODS.find((m) => m.id === receipt.paymentMethod)?.label ??
                  receipt.paymentMethod}
              </strong>
            </li>
            {receipt.endsAt ? (
              <li>
                <span>{t.f_until}</span>
                <strong>{new Date(receipt.endsAt).toLocaleDateString('pt-PT')}</strong>
              </li>
            ) : null}
          </ul>
          <a
            className="btn btn--cta auth__submit"
            href="/vender"
            style={{ marginTop: 'var(--space-2)' }}
          >
            {t.go_dashboard}
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="promote">
      <a className="pdp__back" href="/vender/planos">
        <IconChevronLeft /> {t.back}
      </a>
      <h1 className="section__title">{t.title}</h1>
      <p className="account__muted">{t.subtitle}</p>
      <p className="demo-banner" role="note">
        {t.demo_note}
      </p>

      <form className="card" onSubmit={submit}>
        <label className="field">
          <span className="field__label">{t.f_listing}</span>
          <select className="field__input" value={slug} onChange={(e) => setSlug(e.target.value)}>
            <option value="">{t.pick_listing}</option>
            {listings.map((l) => (
              <option key={l.id} value={l.slug}>
                {l.title} — {formatMZN(cents(l.priceCents))}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span className="field__label">{t.f_plan}</span>
          <div className="planpick">
            {plans.map((p) => (
              <label key={p.code} className={`planpick__opt ${planCode === p.code ? 'is-on' : ''}`}>
                <input
                  type="radio"
                  name="plan"
                  checked={planCode === p.code}
                  onChange={() => setPlanCode(p.code)}
                />
                <span className="planpick__name">{p.name}</span>
                <span className="planpick__desc">
                  {formatMZN(cents(p.priceCents))}
                  {p.durationDays > 0 ? ` · ${p.durationDays} ${t.days}` : ''}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">{t.f_method}</span>
          <div className="chips">
            {METHODS.map((m) => (
              <button
                type="button"
                key={m.id}
                className={`chip ${method === m.id ? 'chip--on' : ''}`}
                onClick={() => setMethod(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn--cta auth__submit" disabled={busy}>
          {busy ? t.processing : t.pay}
        </button>
      </form>
    </section>
  );
}

'use client';
import { IS_DEMO } from '../../../lib/demo';
import { useEffect, useState } from 'react';
import { pt } from '../../../lib/i18n/pt';
import { IconChevronLeft, IconCheck } from '../../../components/icons';
import type { ProductListItem } from '../../../lib/api';
import { formatPrice } from '../../../lib/format';

interface Plan {
  code: string;
  name: string;
  priceCents: number;
  durationDays: number;
}
interface Receipt {
  vendorName: string;
  planName: string;
  amountCents: number;
  paymentMethod: string;
  endsAt: string | null;
}
interface Shop {
  slug: string;
  name: string;
}
const METHODS = [
  { id: 'mpesa', label: 'M-Pesa' },
  { id: 'emola', label: 'e-Mola' },
  { id: 'mkesh', label: 'mKesh' },
];

// Subscribe a shop to Loja Pro (paid verified shop, mock payment). The shop
// list is derived from the catalogue's listings, since there is no vendor-list
// endpoint. Payment is a labelled mock — no real charge — like the rest of the demo.
export default function VerifyShopPage() {
  const t = pt.verify;
  const [shops, setShops] = useState<Shop[]>([]);
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
      .then((d: { items: ProductListItem[] }) => {
        const seen = new Map<string, string>();
        for (const it of d.items ?? []) {
          if (it.vendor?.slug && !seen.has(it.vendor.slug)) {
            seen.set(it.vendor.slug, it.vendor.displayName);
          }
        }
        setShops([...seen].map(([s, name]) => ({ slug: s, name })));
      })
      .catch(() => setShops([]));
    void fetch('/api/subscriptions/plans', { cache: 'no-store' })
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
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vendorSlug: slug, planCode, paymentMethod: method }),
      });
      const data = (await res.json().catch(() => ({}))) as { receipt?: Receipt; message?: string };
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
              <span>{t.f_shop_r}</span>
              <strong>{receipt.vendorName}</strong>
            </li>
            <li>
              <span>{t.f_plan_r}</span>
              <strong>{receipt.planName}</strong>
            </li>
            <li>
              <span>{t.f_amount}</span>
              <strong>{formatPrice(receipt.amountCents)}</strong>
            </li>
            <li>
              <span>{t.f_method_r}</span>
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
      {IS_DEMO ? (
        <p className="demo-banner" role="note">
          {t.demo_note}
        </p>
      ) : null}

      <div className="card" style={{ marginBottom: 'var(--space-3)' }}>
        <strong className="card__title">{t.benefits_title}</strong>
        <ul className="plancard__benefits">
          {[t.b1, t.b2, t.b3].map((b) => (
            <li key={b}>
              <IconCheck width={16} height={16} aria-hidden /> {b}
            </li>
          ))}
        </ul>
      </div>

      <form className="card" onSubmit={submit}>
        <label className="field">
          <span className="field__label">{t.f_shop}</span>
          <select className="field__input" value={slug} onChange={(e) => setSlug(e.target.value)}>
            <option value="">{t.pick_shop}</option>
            {shops.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
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
                  {formatPrice(p.priceCents)} · {t.month}
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

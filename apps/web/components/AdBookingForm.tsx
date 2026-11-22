'use client';
import { IS_DEMO } from '../lib/demo';

const ADS_EMAIL =
  process.env.NEXT_PUBLIC_ADS_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || undefined;
import { useState } from 'react';
import type { Dictionary } from '../lib/i18n/index';
import { formatPrice } from '../lib/format';

type Placement = 'leaderboard' | 'mpu' | 'inline';
const METHODS = [
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'emola', label: 'e-Mola' },
];

// Self-serve ad booking (house-ads monetisation). Books a campaign and pays via
// the mock payments module; the slot goes live immediately. Clearly a demo.
export function AdBookingForm({
  t,
  plans,
  categories,
}: {
  t: Dictionary['ads'];
  plans: Record<string, number>;
  categories: { slug: string; label: string }[];
}) {
  const [advertiserName, setName] = useState('');
  const [advertiserContact, setContact] = useState('');
  const [imageUrl, setImage] = useState('');
  const [clickUrl, setClick] = useState('');
  const [headline, setHeadline] = useState('');
  const [placement, setPlacement] = useState<Placement>('leaderboard');
  const [categorySlug, setCategory] = useState('');
  const [days, setDays] = useState('7');
  const [method, setMethod] = useState('mpesa');
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [done, setDone] = useState<{ endsAt: string } | null>(null);
  const [requested, setRequested] = useState(false);

  const placements: { value: Placement; label: string }[] = [
    { value: 'leaderboard', label: t.fmt_leaderboard },
    { value: 'mpu', label: t.fmt_mpu },
    { value: 'inline', label: t.fmt_inline },
  ];
  const dayNum = Math.max(1, Math.min(90, Math.trunc(Number(days)) || 0));
  const totalCents = (plans[placement] ?? 0) * dayNum;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (advertiserName.trim() === '' || imageUrl.trim() === '' || clickUrl.trim() === '') {
      setState('error');
      return;
    }
    if (!IS_DEMO) {
      // Real campaigns are agreed with sales (price, dates, invoice), so the
      // form becomes a proposal request sent from the advertiser's own email.
      if (!ADS_EMAIL) {
        setState('error');
        return;
      }
      const lines = [
        `${t.f_advertiser}: ${advertiserName}`,
        `${t.f_contact}: ${advertiserContact}`,
        `${t.f_placement}: ${placements.find((p) => p.value === placement)?.label ?? placement}`,
        `${t.f_category}: ${categories.find((c) => c.slug === categorySlug)?.label ?? t.f_all_categories}`,
        `${t.f_days}: ${dayNum}`,
        `${t.total}: ${formatPrice(totalCents)}`,
        `${t.f_image}: ${imageUrl}`,
        `${t.f_click}: ${clickUrl}`,
        headline ? `${t.f_headline}: ${headline}` : '',
      ].filter(Boolean);
      window.location.href = `mailto:${ADS_EMAIL}?subject=${encodeURIComponent(
        `${t.request_subject} — ${advertiserName}`,
      )}&body=${encodeURIComponent(lines.join('\n'))}`;
      setRequested(true);
      setState('idle');
      return;
    }
    setState('saving');
    try {
      const res = await fetch('/api/spot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          advertiserName,
          advertiserContact,
          imageUrl,
          clickUrl,
          headline,
          placement,
          categorySlug: categorySlug || undefined,
          days: dayNum,
          paymentMethod: method,
        }),
      });
      const data = (await res.json()) as { endsAt?: string };
      if (!res.ok || !data.endsAt) {
        setState('error');
        return;
      }
      setDone({ endsAt: data.endsAt });
    } catch {
      setState('error');
    }
  }

  if (requested) {
    return (
      <div className="card spotbooked" role="status">
        <strong className="spotbooked__title">{t.request_title}</strong>
        <p>{t.request_body.replace('{email}', ADS_EMAIL ?? '')}</p>
      </div>
    );
  }

  if (done) {
    const date = new Date(done.endsAt).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    return (
      <div className="card spotbooked" role="status">
        <strong className="spotbooked__title">{t.done_title}</strong>
        <p>{t.done_body.replace('{date}', date)}</p>
      </div>
    );
  }

  return (
    <form className="card spotbook" onSubmit={submit} noValidate>
      <h2 className="spotpage__h2" style={{ marginTop: 0 }}>
        {t.book_title}
      </h2>
      {IS_DEMO ? (
        <p className="notice" role="note">
          {t.demo_pay}
        </p>
      ) : null}

      <label className="field">
        <span className="field__label">{t.f_advertiser} *</span>
        <input
          className="field__input"
          value={advertiserName}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">{t.f_contact}</span>
        <input
          className="field__input"
          value={advertiserContact}
          onChange={(e) => setContact(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">{t.f_image} *</span>
        <input
          className="field__input"
          placeholder="https://…"
          value={imageUrl}
          onChange={(e) => setImage(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">{t.f_click} *</span>
        <input
          className="field__input"
          placeholder="https://…"
          value={clickUrl}
          onChange={(e) => setClick(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">{t.f_headline}</span>
        <input
          className="field__input"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span className="field__label">{t.f_placement}</span>
          <select
            className="field__input"
            value={placement}
            onChange={(e) => setPlacement(e.target.value as Placement)}
          >
            {placements.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label} — {formatPrice(plans[p.value] ?? 0)}
                {t.per_day}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">{t.f_category}</span>
          <select
            className="field__input"
            value={categorySlug}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{t.f_all_categories}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span className="field__label">{t.f_days}</span>
          <input
            className="field__input"
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value.replace(/[^\d]/g, ''))}
          />
        </label>
        {IS_DEMO ? (
          <label className="field">
            <span className="field__label">{t.f_method}</span>
            <select
              className="field__input"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="spotbook__total">
        <span>{t.total}</span>
        <strong>{formatPrice(totalCents)}</strong>
      </div>

      <button type="submit" className="btn btn--primary" disabled={state === 'saving'}>
        {state === 'saving'
          ? t.booking
          : IS_DEMO
            ? `${t.book} · ${formatPrice(totalCents)}`
            : t.request_submit}
      </button>
      {state === 'error' ? (
        <p className="reviewform__msg reviewform__msg--err" role="alert">
          {t.book_error}
        </p>
      ) : null}
    </form>
  );
}

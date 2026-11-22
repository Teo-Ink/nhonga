'use client';
import { IS_DEMO } from '../lib/demo';

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || undefined;
import { useState } from 'react';
import type { Dictionary } from '../lib/i18n/index';

// Open-a-complaint form. In demo mode it sends nothing and says so. Otherwise
// it opens the user's email app with the complaint addressed to support
// (NEXT_PUBLIC_SUPPORT_EMAIL), so every case reaches a real inbox. Takes the help sub-dictionary as a prop so it stays locale-aware
// alongside the server-rendered FAQ.
export function DisputeForm({ t }: { t: Dictionary['help'] }) {
  const [order, setOrder] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sent, setSent] = useState(false);

  const valid = reason !== '' && description.trim() !== '';

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    if (!IS_DEMO && SUPPORT_EMAIL) {
      const reasonLabel =
        {
          not_received: t.d_r_not_received,
          different: t.d_r_different,
          damaged: t.d_r_damaged,
          other: t.d_r_other,
        }[reason] ?? reason;
      const body = [
        `${t.d_reason}: ${reasonLabel}`,
        order ? `${t.d_order}: ${order}` : '',
        '',
        description,
      ]
        .filter((l, i) => l !== '' || i === 2)
        .join('\n');
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
        `${t.dispute_title}: ${reasonLabel}`,
      )}&body=${encodeURIComponent(body)}`;
    }
    setSent(true);
  }

  if (!IS_DEMO && !SUPPORT_EMAIL) {
    // Misconfigured production: never show a form that sends nowhere.
    return (
      <div className="card">
        <h2 className="card__title">{t.dispute_title}</h2>
        <p className="account__muted">{t.d_unavailable}</p>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={onSubmit} noValidate>
      <h2 className="card__title">{t.dispute_title}</h2>
      <p className="account__muted" style={{ marginBottom: 'var(--space-3)' }}>
        {t.dispute_subtitle}
      </p>

      <label className="field">
        <span className="field__label">{t.d_order}</span>
        <input
          className="field__input"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          placeholder={t.d_order_ph}
        />
      </label>

      <label className="field">
        <span className="field__label">
          {t.d_reason} <span aria-hidden="true">*</span>
        </span>
        <select
          className="field__input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={submitted && reason === ''}
        >
          <option value="">{t.d_reason_ph}</option>
          <option value="not_received">{t.d_r_not_received}</option>
          <option value="different">{t.d_r_different}</option>
          <option value="damaged">{t.d_r_damaged}</option>
          <option value="other">{t.d_r_other}</option>
        </select>
      </label>

      <label className="field">
        <span className="field__label">
          {t.d_description} <span aria-hidden="true">*</span>
        </span>
        <textarea
          className="field__input newlisting__textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t.d_description_ph}
          rows={4}
          aria-invalid={submitted && description.trim() === ''}
        />
      </label>

      <button type="submit" className="btn btn--cta auth__submit">
        {t.d_submit}
      </button>

      {submitted && !valid ? (
        <p className="field__error" role="alert">
          {t.d_required}
        </p>
      ) : null}
      {sent ? (
        <p className="auth__notice" role="status">
          {IS_DEMO
            ? `${t.d_sent} ${t.d_not_wired}`
            : t.d_sent_email.replace('{email}', SUPPORT_EMAIL ?? '')}
        </p>
      ) : null}
    </form>
  );
}

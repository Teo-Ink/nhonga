'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { pt } from '../../../lib/i18n/pt';
import { IconChevronLeft } from '../../../components/icons';

// Contact-seller compose. Messaging is not wired: sending persists nothing and
// transmits nothing. The recipient is the real seller passed from their
// storefront, so nothing here is fabricated; the "sent" state is a labelled
// preview plus an honest "not sent in this demo" notice.
function Compose() {
  const t = pt.messages;
  const params = useSearchParams();
  const sellerName = params.get('nome') ?? '';
  const sellerSlug = params.get('loja') ?? '';

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sent, setSent] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (message.trim() === '') {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setSent(true);
  }

  return (
    <section className="section" style={{ maxWidth: 640, margin: '0 auto' }}>
      <a className="pdp__back" href="/mensagens">
        <IconChevronLeft /> {t.back}
      </a>
      <h1 className="section__title">{t.new_title}</h1>

      <form className="card" onSubmit={onSubmit} noValidate style={{ marginTop: 'var(--space-3)' }}>
        {sellerName ? (
          <div className="field">
            <span className="field__label">{t.to}</span>
            <a className="msg-to" href={sellerSlug ? `/loja/${sellerSlug}` : '#'}>
              <span className="msg-to__avatar" aria-hidden="true">
                {sellerName.charAt(0)}
              </span>
              <span>{sellerName}</span>
            </a>
          </div>
        ) : null}

        <label className="field">
          <span className="field__label">{t.subject}</span>
          <input
            className="field__input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t.subject_ph}
          />
        </label>

        <label className="field">
          <span className="field__label">{t.message}</span>
          <textarea
            className="field__input newlisting__textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.message_ph}
            rows={5}
            aria-invalid={submitted && message.trim() === ''}
          />
        </label>

        <button type="submit" className="btn btn--cta auth__submit">
          {t.send}
        </button>

        {submitted && message.trim() === '' ? (
          <p className="field__error" role="alert">
            {t.required}
          </p>
        ) : null}

        {sent ? (
          <div className="msg-sent" role="status">
            <p className="auth__notice" style={{ marginBottom: 'var(--space-3)' }}>
              {t.not_wired}
            </p>
            <p className="account__muted" style={{ marginBottom: 'var(--space-2)' }}>
              {t.sent_preview}
            </p>
            <div className="msg-bubble">
              {subject ? <strong>{subject}</strong> : null}
              <span>{message}</span>
            </div>
          </div>
        ) : null}
      </form>
    </section>
  );
}

export default function NewMessagePage() {
  return (
    <Suspense fallback={<div className="empty">{pt.common.loading}</div>}>
      <Compose />
    </Suspense>
  );
}

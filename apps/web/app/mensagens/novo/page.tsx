'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { pt } from '../../../lib/i18n/pt';
import { IconChevronLeft } from '../../../components/icons';
import { useSession } from '../../../components/auth/SessionProvider';

// Start a conversation with a seller. Posts to the messaging API and opens the
// resulting thread. Signed-out visitors are pointed to sign in first.
function Compose() {
  const t = pt.messages;
  const params = useSearchParams();
  const { user, loading } = useSession();
  const sellerName = params.get('nome') ?? '';
  const sellerSlug = params.get('loja') ?? '';
  const productSlug = params.get('produto') ?? '';

  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);

  const nextUrl = `/mensagens/novo?${params.toString()}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError(false);
    if (message.trim() === '' || !sellerSlug) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          vendorSlug: sellerSlug,
          ...(productSlug ? { productSlug } : {}),
          body: message.trim(),
        }),
      });
      if (res.status === 403) {
        window.location.href = `/entrar?next=${encodeURIComponent(nextUrl)}`;
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      if (!res.ok || !data.id) {
        setError(true);
        return;
      }
      window.location.href = `/mensagens/${data.id}`;
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="section" style={{ maxWidth: 640, margin: '0 auto' }}>
      <a className="pdp__back" href="/mensagens">
        <IconChevronLeft /> {t.back}
      </a>
      <h1 className="section__title">{t.new_title}</h1>

      {!loading && !user ? (
        <div className="card myshop__empty" style={{ marginTop: 'var(--space-3)' }}>
          <p>{t.login_prompt}</p>
          <a className="btn btn--cta" href={`/entrar?next=${encodeURIComponent(nextUrl)}`}>
            {t.login_cta}
          </a>
        </div>
      ) : (
        <form
          className="card"
          onSubmit={onSubmit}
          noValidate
          style={{ marginTop: 'var(--space-3)' }}
        >
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

          <button type="submit" className="btn btn--cta auth__submit" disabled={sending}>
            {sending ? t.loading : t.send}
          </button>

          {submitted && message.trim() === '' ? (
            <p className="field__error" role="alert">
              {t.required}
            </p>
          ) : null}
          {error ? (
            <p className="field__error" role="alert">
              {t.send_error}
            </p>
          ) : null}
        </form>
      )}
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

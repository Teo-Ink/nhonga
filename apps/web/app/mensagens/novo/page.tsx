'use client';
import { Suspense, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { pt } from '../../../lib/i18n/pt';
import { IconChevronLeft } from '../../../components/icons';
import { useSession } from '../../../components/auth/SessionProvider';

const EMOJIS = ['🙂', '👍', '🙏', '📍', '💰', '✅', '📸', '🚗', '🏠', '❤️', '😂', '🔥'];
const MAX_LEN = 1000;

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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const nextUrl = `/mensagens/novo?${params.toString()}`;

  // Wrap the current selection in a WhatsApp-style marker (*bold*, _italic_).
  function wrap(marker: string) {
    const ta = taRef.current;
    const start = ta?.selectionStart ?? message.length;
    const end = ta?.selectionEnd ?? message.length;
    const sel = message.slice(start, end);
    const next = `${message.slice(0, start)}${marker}${sel}${marker}${message.slice(end)}`.slice(
      0,
      MAX_LEN,
    );
    setMessage(next);
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(start + marker.length, start + marker.length + sel.length);
    });
  }
  // Insert text (emoji / quick question) at the cursor.
  function insertAtCursor(text: string) {
    const ta = taRef.current;
    const start = ta?.selectionStart ?? message.length;
    const end = ta?.selectionEnd ?? message.length;
    const next = `${message.slice(0, start)}${text}${message.slice(end)}`.slice(0, MAX_LEN);
    setMessage(next);
    requestAnimationFrame(() => {
      ta?.focus();
      const pos = Math.min(start + text.length, MAX_LEN);
      ta?.setSelectionRange(pos, pos);
    });
  }
  function addQuick(text: string) {
    insertAtCursor((message && !message.endsWith(' ') ? ' ' : '') + text);
  }

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

          <div className="field">
            <span className="field__label">{t.message}</span>

            {/* Quick-question chips — one tap to insert a common message. */}
            <div className="msgquick">
              {[t.quick1, t.quick2, t.quick3, t.quick4].map((qq) => (
                <button
                  key={qq}
                  type="button"
                  className="msgquick__chip"
                  onClick={() => addQuick(qq)}
                >
                  {qq}
                </button>
              ))}
            </div>

            <div className="msgeditor">
              {/* Formatting toolbar (WhatsApp-style markers). */}
              <div className="msgtool" role="toolbar" aria-label={t.message}>
                <button
                  type="button"
                  className="msgtool__btn"
                  title={t.fmt_bold}
                  aria-label={t.fmt_bold}
                  onClick={() => wrap('*')}
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  className="msgtool__btn"
                  title={t.fmt_italic}
                  aria-label={t.fmt_italic}
                  onClick={() => wrap('_')}
                >
                  <em>I</em>
                </button>
                <button
                  type="button"
                  className="msgtool__btn"
                  title={t.fmt_strike}
                  aria-label={t.fmt_strike}
                  onClick={() => wrap('~')}
                >
                  <s>S</s>
                </button>
                <button
                  type="button"
                  className={`msgtool__btn ${emojiOpen ? 'is-on' : ''}`}
                  title={t.fmt_emoji}
                  aria-label={t.fmt_emoji}
                  aria-expanded={emojiOpen}
                  onClick={() => setEmojiOpen((v) => !v)}
                >
                  🙂
                </button>
                <span className="msgcount">
                  {message.length}/{MAX_LEN}
                </span>
              </div>

              {emojiOpen ? (
                <div className="msgemoji">
                  {EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      className="msgemoji__btn"
                      onClick={() => {
                        insertAtCursor(em);
                        setEmojiOpen(false);
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              ) : null}

              <textarea
                ref={taRef}
                className="field__input msgeditor__area"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
                placeholder={t.message_ph}
                rows={5}
                maxLength={MAX_LEN}
                aria-invalid={submitted && message.trim() === ''}
              />
            </div>
            <p className="msgeditor__hint">{t.fmt_hint}</p>
          </div>

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

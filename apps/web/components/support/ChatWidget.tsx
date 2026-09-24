'use client';
import { useEffect, useRef, useState } from 'react';
import { IconChat } from '../icons';
import type { Dictionary } from '../../lib/i18n/index';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

// Floating AI customer-service assistant. Stateless on the server — the whole
// transcript is sent each turn to /api/assistant/chat (BFF → NestJS → Claude).
export function ChatWidget({ t }: { t: Dictionary['assistant'] }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: t.greeting }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      inputRef.current?.focus();
    }
  }, [open, messages, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (text === '' || busy) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Only the model-visible turns (skip the local greeting) go upstream.
        body: JSON.stringify({ messages: next.filter((_, i) => i > 0) }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string };
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: res.ok && data.reply ? data.reply : t.error },
      ]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: t.error }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`chatfab ${open ? 'is-open' : ''}`}
        aria-label={open ? t.close : t.open}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <span aria-hidden="true">×</span> : <IconChat width={24} height={24} />}
      </button>

      {open ? (
        <section className="chatpanel" role="dialog" aria-label={t.title}>
          <header className="chatpanel__head">
            <span className="chatpanel__avatar" aria-hidden="true">
              <IconChat width={18} height={18} />
            </span>
            <span className="chatpanel__titles">
              <strong>{t.title}</strong>
              <small>{t.subtitle}</small>
            </span>
            <button
              type="button"
              className="chatpanel__close"
              aria-label={t.close}
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          <div className="chatpanel__body" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chatmsg chatmsg--${m.role}`}>
                {m.content}
              </div>
            ))}
            {busy ? (
              <div className="chatmsg chatmsg--assistant chatmsg--typing" aria-live="polite">
                <span className="chatdot" />
                <span className="chatdot" />
                <span className="chatdot" />
                <span className="sr-only">{t.thinking}</span>
              </div>
            ) : null}
          </div>

          <form className="chatpanel__input" onSubmit={send}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.placeholder}
              aria-label={t.placeholder}
              maxLength={2000}
            />
            <button
              type="submit"
              className="chatpanel__send"
              disabled={busy || input.trim() === ''}
            >
              {t.send}
            </button>
          </form>
          <p className="chatpanel__disclaimer">{t.disclaimer}</p>
        </section>
      ) : null}
    </>
  );
}

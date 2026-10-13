'use client';
import { use, useEffect, useRef, useState } from 'react';
import { pt } from '../../../lib/i18n/pt';
import { IconChevronLeft } from '../../../components/icons';
import { FormattedMessage } from '../../../components/FormattedMessage';

interface Msg {
  id: string;
  mine: boolean;
  body: string;
  createdAt: string;
}
interface Thread {
  counterpart: string;
  productTitle: string | null;
  messages: Msg[];
}

// A conversation thread: the messages plus a reply box. Polls while open so a
// reply from the other side shows up without a manual refresh.
export default function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = pt.messages;
  const [thread, setThread] = useState<Thread | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  function load() {
    return fetch(`/api/conversations/${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Thread | null) => d && setThread(d))
      .catch(() => undefined);
  }

  useEffect(() => {
    void load().finally(() => setLoaded(true));
    const iv = window.setInterval(() => void load(), 8000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener('focus', onFocus);
    };
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [thread?.messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(false);
    setText('');
    try {
      const res = await fetch(`/api/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        setError(true);
        setText(body);
      } else {
        await load();
      }
    } catch {
      setError(true);
      setText(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="section msgthread">
      <a className="pdp__back" href="/mensagens">
        <IconChevronLeft /> {t.back}
      </a>

      {!loaded ? (
        <p className="account__muted">{t.loading}</p>
      ) : !thread ? (
        <p className="account__muted">{t.thread_empty}</p>
      ) : (
        <>
          <header className="msgthread__head">
            <strong>{thread.counterpart}</strong>
            {thread.productTitle ? (
              <span className="msgthread__about">
                {t.about}: {thread.productTitle}
              </span>
            ) : null}
          </header>

          <div className="msgthread__scroll">
            {thread.messages.length === 0 ? (
              <p className="account__muted">{t.thread_empty}</p>
            ) : (
              thread.messages.map((m) => (
                <div key={m.id} className={`bubble ${m.mine ? 'bubble--mine' : 'bubble--them'}`}>
                  <FormattedMessage text={m.body} />
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          <form className="msgthread__form" onSubmit={send}>
            <input
              className="field__input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.reply_ph}
              aria-label={t.reply_ph}
            />
            <button type="submit" className="btn btn--cta" disabled={sending || text.trim() === ''}>
              {t.send_reply}
            </button>
          </form>
          {error ? (
            <p className="field__error" role="alert">
              {t.send_error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

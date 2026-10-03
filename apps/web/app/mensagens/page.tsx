'use client';
import { useEffect, useState } from 'react';
import { pt } from '../../lib/i18n/pt';
import { IconChat } from '../../components/icons';
import { useSession } from '../../components/auth/SessionProvider';

interface Conv {
  id: string;
  counterpart: string;
  productTitle: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
  unread: number;
  role: 'buyer' | 'seller';
}

function ago(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

// Messages inbox — the signed-in user's real conversations (as buyer or seller).
export default function MessagesPage() {
  const t = pt.messages;
  const { user, loading } = useSession();
  const [items, setItems] = useState<Conv[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setLoaded(true);
      return;
    }
    void fetch('/api/conversations', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { items?: Conv[] }) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoaded(true));
  }, [user, loading]);

  return (
    <section className="section msgpage">
      <h1 className="section__title">{t.title}</h1>

      {!loaded || loading ? (
        <p className="account__muted">{t.loading}</p>
      ) : !user ? (
        <div className="card myshop__empty">
          <p>{t.login_prompt}</p>
          <a className="btn btn--cta" href="/entrar">
            {t.login_cta}
          </a>
        </div>
      ) : items.length === 0 ? (
        <div className="card myshop__empty">
          <IconChat width={28} height={28} />
          <strong>{t.empty_title}</strong>
          <p className="account__muted">{t.empty_body}</p>
          <a className="btn btn--cta" href="/">
            {t.browse}
          </a>
        </div>
      ) : (
        <ul className="convlist">
          {items.map((c) => (
            <li key={c.id}>
              <a className={`convrow ${c.unread > 0 ? 'is-unread' : ''}`} href={`/mensagens/${c.id}`}>
                <span className="convrow__avatar" aria-hidden="true">
                  {c.counterpart.charAt(0)}
                </span>
                <span className="convrow__main">
                  <span className="convrow__top">
                    <strong className="convrow__name">{c.counterpart}</strong>
                    <span className="convrow__time">{ago(c.lastMessageAt)}</span>
                  </span>
                  {c.productTitle ? (
                    <span className="convrow__about">{c.productTitle}</span>
                  ) : null}
                  {c.lastMessage ? <span className="convrow__last">{c.lastMessage}</span> : null}
                </span>
                {c.unread > 0 ? <span className="convrow__badge">{c.unread}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { pt } from '../../../lib/i18n/pt';
import { IconChevronLeft, IconChat, IconStar } from '../../../components/icons';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  isRead: boolean;
  createdAt: string;
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

// Seller notifications (new contact / new review). Marks everything read on
// open, so the unread badge clears once the seller has looked.
export default function NotificationsPage() {
  const t = pt.sell;
  const [items, setItems] = useState<Notif[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefs] = useState<{ contact: boolean; review: boolean }>({
    contact: true,
    review: true,
  });
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    void fetch('/api/notifications', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { items: Notif[] }) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => {
        setLoaded(true);
        void fetch('/api/notifications/read', { method: 'POST' }).catch(() => undefined);
      });
    void fetch('/api/notifications/prefs', { cache: 'no-store' })
      .then((r) => r.json())
      .then((p: { contact?: boolean; review?: boolean }) =>
        setPrefs({ contact: p.contact !== false, review: p.review !== false }),
      )
      .catch(() => undefined);
  }, []);

  function togglePref(key: 'contact' | 'review') {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    void fetch('/api/notifications/prefs', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    })
      .then(() => {
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 1800);
      })
      .catch(() => undefined);
  }

  return (
    <section className="notifpage">
      <a className="pdp__back" href="/vender">
        <IconChevronLeft /> {t.notif_back}
      </a>
      <h1 className="section__title">{t.notif_title}</h1>

      <div className="card notifprefs">
        <strong className="card__title">{t.notif_prefs}</strong>
        {(['contact', 'review'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className="notifprefs__row"
            role="switch"
            aria-checked={prefs[key]}
            onClick={() => togglePref(key)}
          >
            <span>{key === 'contact' ? t.notif_pref_contact : t.notif_pref_review}</span>
            <span className="datasaver__track" aria-hidden="true">
              <span className="datasaver__thumb" />
            </span>
          </button>
        ))}
        {savedFlash ? (
          <span className="notifprefs__saved" role="status">
            {t.notif_pref_saved}
          </span>
        ) : null}
      </div>

      {loaded && items.length === 0 ? (
        <p className="account__muted">{t.notif_empty}</p>
      ) : (
        <ul className="notiflist">
          {items.map((n) => {
            const inner = (
              <>
                <span className={`notif__icon notif__icon--${n.type}`} aria-hidden="true">
                  {n.type === 'review' ? (
                    <IconStar width={16} height={16} />
                  ) : (
                    <IconChat width={16} height={16} />
                  )}
                </span>
                <span className="notif__text">
                  <strong>{n.title}</strong>
                  {n.body ? <span className="notif__body">{n.body}</span> : null}
                  <span className="notif__time">{ago(n.createdAt)}</span>
                </span>
              </>
            );
            return (
              <li className={`notif ${n.isRead ? '' : 'is-unread'}`} key={n.id}>
                {n.href ? (
                  <a className="notif__link" href={n.href}>
                    {inner}
                  </a>
                ) : (
                  <span className="notif__link">{inner}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

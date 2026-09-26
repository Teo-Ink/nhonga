'use client';
import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/ui';
import { IconBell } from '../../components/icons';
import { pt } from '../../lib/i18n/pt';
import type { SavedSearch } from '../../components/SaveSearch';

const KEY = 'nhonga_saved_searches';
const read = (): SavedSearch[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedSearch[];
  } catch {
    return [];
  }
};

// Saved searches (C), backed by the per-device local list. Alerts (push/SMS)
// are not wired — stated honestly on the page.
export default function SavedSearchesPage() {
  const t = pt.saved;
  const [list, setList] = useState<SavedSearch[] | null>(null);

  useEffect(() => {
    setList(read());
    const onChange = () => setList(read());
    window.addEventListener('nhonga-saved', onChange);
    return () => window.removeEventListener('nhonga-saved', onChange);
  }, []);

  function remove(href: string) {
    const next = read().filter((s) => s.href !== href);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
    setList(next);
    window.dispatchEvent(new Event('nhonga-saved'));
  }

  return (
    <section className="section">
      <div className="section__head">
        <h1 className="section__title">{t.title}</h1>
      </div>
      <p className="adpage__lead">{t.subtitle}</p>
      <p className="notice" role="note">
        {t.alerts_note}
      </p>

      {list === null ? (
        <div className="empty" role="status">
          <p>{pt.common.loading}</p>
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={<IconBell width={40} height={40} />}>
          <strong style={{ display: 'block', color: 'var(--text)', fontSize: 'var(--text-lg)' }}>
            {t.empty_title}
          </strong>
          {t.empty_body}
          <a className="btn btn--cta" href="/" style={{ maxWidth: 220, marginTop: 8 }}>
            {t.browse}
          </a>
        </EmptyState>
      ) : (
        <ul className="savedlist">
          {list.map((s) => (
            <li className="saveditem" key={s.href}>
              <a className="saveditem__main" href={s.href}>
                <IconBell width={18} height={18} aria-hidden />
                <span className="saveditem__label">{s.label}</span>
              </a>
              <div className="saveditem__actions">
                <a className="btn btn--ghost saveditem__view" href={s.href}>
                  {t.view}
                </a>
                <button type="button" className="saveditem__remove" onClick={() => remove(s.href)}>
                  {t.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

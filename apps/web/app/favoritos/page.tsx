'use client';
import { useEffect, useState } from 'react';
import { ProductCard } from '../../components/ProductCard';
import { EmptyState } from '../../components/ui';
import { IconHeart } from '../../components/icons';
import { pt } from '../../lib/i18n/pt';
import type { ProductListItem } from '../../lib/api';

const KEY = 'nhonga_favs';
const favIds = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

// Favourites (Wallapop-style), backed by the per-device local list. Fetches the
// listings feed and shows the ones the viewer has saved; updates live when a
// heart is toggled anywhere.
export default function FavouritesPage() {
  const t = pt;
  const [all, setAll] = useState<ProductListItem[] | null>(null);
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(favIds());
    void fetch('/api/listings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { items: ProductListItem[] }) => setAll(d.items ?? []))
      .catch(() => setAll([]));
    const onChange = () => setIds(favIds());
    window.addEventListener('nhonga-favs', onChange);
    return () => window.removeEventListener('nhonga-favs', onChange);
  }, []);

  const items = (all ?? []).filter((p) => ids.includes(p.id));

  return (
    <section className="section">
      <div className="section__head">
        <h1 className="section__title">{t.favs.title}</h1>
        {items.length > 0 ? (
          <span className="results__count">
            {items.length === 1
              ? t.favs.count_one
              : t.favs.count_many.replace('{n}', String(items.length))}
          </span>
        ) : null}
      </div>

      {all === null ? (
        <div className="empty" role="status">
          <p>{t.common.loading}</p>
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<IconHeart width={40} height={40} />}>
          <strong style={{ display: 'block', color: 'var(--text)', fontSize: 'var(--text-lg)' }}>
            {t.favs.empty_title}
          </strong>
          {t.favs.empty_body}
          <a className="btn btn--cta" href="/" style={{ maxWidth: 220, marginTop: 8 }}>
            {t.favs.browse}
          </a>
        </EmptyState>
      ) : (
        <div className="grid grid--listings">
          {items.map((p) => (
            <ProductCard key={p.id} p={p} t={t} />
          ))}
        </div>
      )}
    </section>
  );
}

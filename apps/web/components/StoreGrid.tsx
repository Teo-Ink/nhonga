'use client';
import { useState } from 'react';
import { ProductCard } from './ProductCard';
import { EmptyState } from './ui';
import { IconBox } from './icons';
import type { ProductListItem } from '../lib/api';
import type { Dictionary } from '../lib/i18n/index';

// A seller's storefront grid with client-side category chips, so a buyer can
// narrow a shop's listings by vertical (Viaturas, Moda, …). The chips are
// derived from the shop's own listings, so only categories it actually sells
// are offered.
export function StoreGrid({ items, t }: { items: ProductListItem[]; t: Dictionary }) {
  const [cat, setCat] = useState('');
  const cats = Array.from(
    new Map(items.map((i) => [i.category.slug, i.category.name] as const)).entries(),
  );
  const shown = cat ? items.filter((i) => i.category.slug === cat) : items;

  return (
    <section className="section" aria-label={t.seller.products}>
      {cats.length > 1 ? (
        <div className="storecats" role="tablist" aria-label={t.common.all_categories}>
          <button
            type="button"
            role="tab"
            aria-selected={cat === ''}
            className={`storecat ${cat === '' ? 'is-on' : ''}`}
            onClick={() => setCat('')}
          >
            {t.common.all_categories}
          </button>
          {cats.map(([slug, name]) => (
            <button
              key={slug}
              type="button"
              role="tab"
              aria-selected={cat === slug}
              className={`storecat ${cat === slug ? 'is-on' : ''}`}
              onClick={() => setCat(slug)}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <EmptyState icon={<IconBox />}>{t.seller.no_products}</EmptyState>
      ) : (
        <div className="grid">
          {shown.map((p) => (
            <ProductCard key={p.id} p={p} t={t} />
          ))}
        </div>
      )}
    </section>
  );
}

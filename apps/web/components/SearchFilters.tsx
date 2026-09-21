'use client';
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Dictionary } from '../lib/i18n/index';

const CATEGORY_KEYS = [
  'moda',
  'electronica',
  'telemoveis',
  'casa',
  'alimentacao',
  'beleza',
] as const;

// eBay-structured filter rail (in Nhonga's own look): category list, price range,
// and availability. Every control writes to the URL query so the server re-runs
// the filtered catalogue query — shareable and back-button friendly. On phones
// it collapses behind a "Filtros" button. When `lockedCategory` is set (category
// landing pages) the category list is hidden and stays fixed.
export function SearchFilters({ t, lockedCategory }: { t: Dictionary; lockedCategory?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  const activeCategory = params.get('category') ?? '';
  const minCents = params.get('minPrice');
  const maxCents = params.get('maxPrice');
  const inStock = params.get('inStock') === 'true';

  const [min, setMin] = useState(minCents ? String(Math.round(Number(minCents) / 100)) : '');
  const [max, setMax] = useState(maxCents ? String(Math.round(Number(maxCents) / 100)) : '');

  function push(next: URLSearchParams) {
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }
  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    push(next);
  }
  function applyPrice(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params.toString());
    const toCents = (v: string): string | null => {
      const n = Number(v.replace(',', '.'));
      return v.trim() !== '' && Number.isFinite(n) && n >= 0 ? String(Math.round(n * 100)) : null;
    };
    const lo = toCents(min);
    const hi = toCents(max);
    if (lo) next.set('minPrice', lo);
    else next.delete('minPrice');
    if (hi) next.set('maxPrice', hi);
    else next.delete('maxPrice');
    push(next);
  }

  return (
    <aside className="filters">
      <button
        type="button"
        className="filters__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t.search.filters_title}
      </button>

      <div className={`filters__body ${open ? 'is-open' : ''}`}>
        {lockedCategory === undefined ? (
          <div className="filtergroup">
            <h2 className="filtergroup__title">{t.search.categories}</h2>
            <ul className="filterlist">
              <li>
                <button
                  type="button"
                  className={`filterlink ${activeCategory === '' ? 'is-active' : ''}`}
                  onClick={() => setParam('category', null)}
                >
                  {t.search.all_categories}
                </button>
              </li>
              {CATEGORY_KEYS.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    className={`filterlink ${activeCategory === k ? 'is-active' : ''}`}
                    onClick={() => setParam('category', k)}
                  >
                    {t.categories[k]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <form className="filtergroup" onSubmit={applyPrice}>
          <h2 className="filtergroup__title">{t.search.price}</h2>
          <div className="pricerange">
            <label className="sr-only" htmlFor="pmin">
              {t.search.price_from}
            </label>
            <input
              id="pmin"
              className="field__input"
              inputMode="numeric"
              placeholder={t.search.price_from}
              value={min}
              onChange={(e) => setMin(e.target.value.replace(/[^\d]/g, ''))}
            />
            <span aria-hidden="true">–</span>
            <label className="sr-only" htmlFor="pmax">
              {t.search.price_to}
            </label>
            <input
              id="pmax"
              className="field__input"
              inputMode="numeric"
              placeholder={t.search.price_to}
              value={max}
              onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ''))}
            />
          </div>
          <button type="submit" className="btn btn--ghost filtergroup__apply">
            {t.search.apply}
          </button>
        </form>

        <div className="filtergroup">
          <h2 className="filtergroup__title">{t.search.availability}</h2>
          <label className="checkline">
            <input
              type="checkbox"
              checked={inStock}
              onChange={() => setParam('inStock', inStock ? null : 'true')}
            />
            <span>{t.search.in_stock_only}</span>
          </label>
        </div>
      </div>
    </aside>
  );
}

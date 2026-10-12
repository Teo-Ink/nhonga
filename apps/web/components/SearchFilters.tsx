'use client';
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Dictionary } from '../lib/i18n/index';
import type { CategoryAttribute } from '../lib/api';

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
export function SearchFilters({
  t,
  lockedCategory,
  attributes,
}: {
  t: Dictionary;
  lockedCategory?: string;
  /** Per-category filterable attributes (verticals). Rendered as extra groups. */
  attributes?: CategoryAttribute[];
}) {
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
  // Numeric attribute ranges live in two params: `<key>_min` / `<key>_max`.
  function setRange(key: string, min: string, max: string) {
    const next = new URLSearchParams(params.toString());
    const clean = (v: string): string | null => {
      const n = Number(v.replace(',', '.'));
      return v.trim() !== '' && Number.isFinite(n) && n >= 0 ? String(Math.round(n)) : null;
    };
    const lo = clean(min);
    const hi = clean(max);
    if (lo) next.set(`${key}_min`, lo);
    else next.delete(`${key}_min`);
    if (hi) next.set(`${key}_max`, hi);
    else next.delete(`${key}_max`);
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

        {attributes?.map((a) => (
          <AttrFilter
            key={a.key}
            attr={a}
            params={params}
            setParam={setParam}
            setRange={setRange}
          />
        ))}

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

// One filter group for a category attribute. Enum → toggle buttons; text →
// free-text with apply; number → a min/max range (mirrors the price control).
function AttrFilter({
  attr,
  params,
  setParam,
  setRange,
}: {
  attr: CategoryAttribute;
  params: ReturnType<typeof useSearchParams>;
  setParam: (key: string, value: string | null) => void;
  setRange: (key: string, min: string, max: string) => void;
}) {
  const active = params.get(attr.key) ?? '';
  const [text, setText] = useState(active);
  const [min, setMin] = useState(params.get(`${attr.key}_min`) ?? '');
  const [max, setMax] = useState(params.get(`${attr.key}_max`) ?? '');

  if (attr.dataType === 'enum' && attr.options && attr.options.length > 0) {
    return (
      <div className="filtergroup">
        <h2 className="filtergroup__title">{attr.label}</h2>
        <ul className="filterlist">
          {attr.options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                className={`filterlink ${active === opt ? 'is-active' : ''}`}
                onClick={() => setParam(attr.key, active === opt ? null : opt)}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (attr.dataType === 'number') {
    return (
      <form
        className="filtergroup"
        onSubmit={(e) => {
          e.preventDefault();
          setRange(attr.key, min, max);
        }}
      >
        <h2 className="filtergroup__title">{attr.label}</h2>
        <div className="pricerange">
          <input
            className="field__input"
            inputMode="numeric"
            aria-label={`${attr.label} min`}
            placeholder="Min"
            value={min}
            onChange={(e) => setMin(e.target.value.replace(/[^\d]/g, ''))}
          />
          <span aria-hidden="true">–</span>
          <input
            className="field__input"
            inputMode="numeric"
            aria-label={`${attr.label} max`}
            placeholder="Máx"
            value={max}
            onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ''))}
          />
        </div>
        <button type="submit" className="btn btn--ghost filtergroup__apply">
          OK
        </button>
      </form>
    );
  }

  // text (and any boolean/other) → free-text exact match
  return (
    <form
      className="filtergroup"
      onSubmit={(e) => {
        e.preventDefault();
        setParam(attr.key, text.trim() === '' ? null : text.trim());
      }}
    >
      <h2 className="filtergroup__title">{attr.label}</h2>
      <input
        className="field__input"
        value={text}
        placeholder={attr.label}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" className="btn btn--ghost filtergroup__apply">
        OK
      </button>
    </form>
  );
}

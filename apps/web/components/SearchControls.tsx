'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Dictionary } from '../lib/i18n/index';

// Sort dropdown + in-stock toggle. Both write to the URL query so the server
// re-runs the filtered query; keeps state shareable and back-button friendly.
export function SearchControls({ t }: { t: Dictionary }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  const sort = params.get('sort') ?? 'relevance';
  const inStock = params.get('inStock') === 'true';

  return (
    <div className="ctrls">
      <label className="ctrls__sort">
        <span className="sr-only">{t.search.sort}</span>
        <select
          aria-label={t.search.sort}
          value={sort}
          onChange={(e) => setParam('sort', e.target.value === 'relevance' ? null : e.target.value)}
        >
          <option value="relevance">{t.search.sort_relevance}</option>
          <option value="price_asc">{t.search.sort_price_asc}</option>
          <option value="price_desc">{t.search.sort_price_desc}</option>
          <option value="rating">{t.search.sort_rating}</option>
          <option value="newest">{t.search.sort_newest}</option>
        </select>
      </label>

      <button
        type="button"
        role="switch"
        aria-checked={inStock}
        className={inStock ? 'toggle toggle--on' : 'toggle'}
        onClick={() => setParam('inStock', inStock ? null : 'true')}
      >
        <span className="toggle__dot" aria-hidden />
        {t.search.in_stock_only}
      </button>
    </div>
  );
}

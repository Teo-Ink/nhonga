'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Dictionary } from '../lib/i18n/index';

// Sort dropdown for the results header. Writes to the URL query so the server
// re-runs the sorted query; availability and other filters live in the rail.
export function SearchControls({ t }: { t: Dictionary }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const sort = params.get('sort') ?? 'relevance';

  return (
    <label className="ctrls__sort">
      <span className="ctrls__sort-label">{t.search.sort}:</span>
      <select
        aria-label={t.search.sort}
        value={sort}
        onChange={(e) => setParam('sort', e.target.value === 'relevance' ? null : e.target.value)}
      >
        <option value="relevance">{t.search.sort_relevance}</option>
        <option value="newest">{t.search.sort_newest}</option>
        <option value="price_asc">{t.search.sort_price_asc}</option>
        <option value="price_desc">{t.search.sort_price_desc}</option>
      </select>
    </label>
  );
}

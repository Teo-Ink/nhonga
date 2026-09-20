import { SearchResults, type ActiveChip } from '../../components/SearchResults';
import { searchProducts, type ProductListItem } from '../../lib/api';
import { getDictionary } from '../../lib/i18n/index';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { t } = await getDictionary();
  const q = one(sp.q) ?? '';
  const sort = one(sp.sort);
  const inStock = one(sp.inStock) === 'true';

  let items: ProductListItem[] = [];
  let total = 0;
  try {
    const r = await searchProducts({ q, ...(sort ? { sort } : {}), inStock });
    items = r.items;
    total = r.total;
  } catch {
    /* render as empty */
  }

  const keep = (drop: string) => {
    const p = new URLSearchParams();
    if (q && drop !== 'q') p.set('q', q);
    if (sort && drop !== 'sort') p.set('sort', sort);
    if (inStock && drop !== 'inStock') p.set('inStock', 'true');
    return `/pesquisa?${p.toString()}`;
  };
  const chips: ActiveChip[] = [];
  if (q) chips.push({ label: `“${q}”`, removeHref: keep('q') });
  if (inStock) chips.push({ label: t.search.in_stock_only, removeHref: keep('inStock') });

  const title = q ? `${t.search.results_for} “${q}”` : t.home.featured;
  return (
    <SearchResults
      t={t}
      title={title}
      items={items}
      total={total}
      chips={chips}
      clearHref="/pesquisa"
    />
  );
}

import { SearchResults, type ActiveChip } from '../../components/SearchResults';
import { searchProducts, type ProductListItem } from '../../lib/api';
import { getDictionary } from '../../lib/i18n/index';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
const CATEGORY_KEYS = [
  'moda',
  'electronica',
  'telemoveis',
  'casa',
  'alimentacao',
  'beleza',
] as const;

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { t } = await getDictionary();
  const q = one(sp.q) ?? '';
  const sort = one(sp.sort);
  const category = one(sp.category);
  const minPrice = one(sp.minPrice);
  const maxPrice = one(sp.maxPrice);
  const inStock = one(sp.inStock) === 'true';

  let items: ProductListItem[] = [];
  let total = 0;
  try {
    const r = await searchProducts({
      q,
      ...(sort ? { sort } : {}),
      ...(category ? { category } : {}),
      ...(minPrice ? { minPrice: Number(minPrice) } : {}),
      ...(maxPrice ? { maxPrice: Number(maxPrice) } : {}),
      inStock,
    });
    items = r.items;
    total = r.total;
  } catch {
    /* render as empty */
  }

  // Rebuild the query string, dropping one key — used to make each chip removable.
  const keep = (drop: string): string => {
    const p = new URLSearchParams();
    if (q && drop !== 'q') p.set('q', q);
    if (sort && drop !== 'sort') p.set('sort', sort);
    if (category && drop !== 'category') p.set('category', category);
    if (minPrice && drop !== 'minPrice') p.set('minPrice', minPrice);
    if (maxPrice && drop !== 'maxPrice') p.set('maxPrice', maxPrice);
    if (inStock && drop !== 'inStock') p.set('inStock', 'true');
    const s = p.toString();
    return s ? `/pesquisa?${s}` : '/pesquisa';
  };

  const catLabel = (slug: string): string =>
    (CATEGORY_KEYS as readonly string[]).includes(slug)
      ? t.categories[slug as (typeof CATEGORY_KEYS)[number]]
      : slug;
  const mt = (cents: string): string => String(Math.round(Number(cents) / 100));

  // Removing the price chip clears both bounds at once.
  const keepDropPrice = (): string => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (sort) p.set('sort', sort);
    if (category) p.set('category', category);
    if (inStock) p.set('inStock', 'true');
    const s = p.toString();
    return s ? `/pesquisa?${s}` : '/pesquisa';
  };

  const chips: ActiveChip[] = [];
  if (q) chips.push({ label: `“${q}”`, removeHref: keep('q') });
  if (category) chips.push({ label: catLabel(category), removeHref: keep('category') });
  if (minPrice || maxPrice) {
    const lo = minPrice ? mt(minPrice) : '0';
    const hi = maxPrice ? mt(maxPrice) : '∞';
    chips.push({ label: `${lo}–${hi} MT`, removeHref: keepDropPrice() });
  }
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
      crumbs={[{ label: t.common.brand, href: '/' }, { label: t.search.crumb }]}
    />
  );
}

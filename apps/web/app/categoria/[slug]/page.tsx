import { SearchResults, type ActiveChip } from '../../../components/SearchResults';
import { searchProducts, type ProductListItem } from '../../../lib/api';
import { getDictionary } from '../../../lib/i18n/index';
import type { Dictionary } from '../../../lib/i18n/index';

export const dynamic = 'force-dynamic';

const CAT_KEYS = ['moda', 'electronica', 'telemoveis', 'casa', 'alimentacao', 'beleza'] as const;
type CatKey = (typeof CAT_KEYS)[number];
const isCat = (s: string): s is CatKey => (CAT_KEYS as readonly string[]).includes(s);

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { t } = await getDictionary();
  const one = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const sort = one(sp.sort);
  const minPrice = one(sp.minPrice);
  const maxPrice = one(sp.maxPrice);
  const inStock = one(sp.inStock) === 'true';

  let items: ProductListItem[] = [];
  let total = 0;
  try {
    const r = await searchProducts({
      category: slug,
      ...(sort ? { sort } : {}),
      ...(minPrice ? { minPrice: Number(minPrice) } : {}),
      ...(maxPrice ? { maxPrice: Number(maxPrice) } : {}),
      inStock,
    });
    items = r.items;
    total = r.total;
  } catch {
    /* empty */
  }

  const base = `/categoria/${slug}`;
  const keep = (drop: string): string => {
    const p = new URLSearchParams();
    if (sort && drop !== 'sort') p.set('sort', sort);
    if (inStock && drop !== 'inStock') p.set('inStock', 'true');
    if (minPrice && drop !== 'price') p.set('minPrice', minPrice);
    if (maxPrice && drop !== 'price') p.set('maxPrice', maxPrice);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const mt = (c: string): string => String(Math.round(Number(c) / 100));

  const chips: ActiveChip[] = [];
  if (minPrice || maxPrice) {
    chips.push({
      label: `${minPrice ? mt(minPrice) : '0'}–${maxPrice ? mt(maxPrice) : '∞'} MT`,
      removeHref: keep('price'),
    });
  }
  if (inStock) chips.push({ label: t.search.in_stock_only, removeHref: keep('inStock') });

  const label = isCat(slug) ? (t.categories as Dictionary['categories'])[slug] : slug;
  return (
    <SearchResults
      t={t}
      title={label}
      items={items}
      total={total}
      chips={chips}
      clearHref={base}
      lockedCategory={slug}
      crumbs={[
        { label: t.common.brand, href: '/' },
        { label: t.search.categories, href: '/' },
        { label },
      ]}
    />
  );
}

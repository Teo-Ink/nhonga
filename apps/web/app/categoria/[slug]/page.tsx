import { SearchResults } from '../../../components/SearchResults';
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
  const sort = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const inStock = (Array.isArray(sp.inStock) ? sp.inStock[0] : sp.inStock) === 'true';

  let items: ProductListItem[] = [];
  let total = 0;
  try {
    const r = await searchProducts({ category: slug, ...(sort ? { sort } : {}), inStock });
    items = r.items;
    total = r.total;
  } catch {
    /* empty */
  }

  const label = isCat(slug) ? (t.categories as Dictionary['categories'])[slug] : slug;
  return (
    <SearchResults
      t={t}
      title={label}
      items={items}
      total={total}
      chips={inStock ? [{ label: t.search.in_stock_only, removeHref: `/categoria/${slug}` }] : []}
      clearHref={`/categoria/${slug}`}
    />
  );
}

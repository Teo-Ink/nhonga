import { SearchResults, type ActiveChip } from '../../../components/SearchResults';
import {
  getCategoryAttributes,
  searchProducts,
  type AttributeFilter,
  type CategoryAttribute,
  type ProductListItem,
} from '../../../lib/api';
import { getDictionary } from '../../../lib/i18n/index';
import type { Dictionary } from '../../../lib/i18n/index';

export const dynamic = 'force-dynamic';

const CAT_KEYS = ['moda', 'electronica', 'telemoveis', 'casa', 'alimentacao', 'beleza'] as const;
type CatKey = (typeof CAT_KEYS)[number];
const isCat = (s: string): s is CatKey => (CAT_KEYS as readonly string[]).includes(s);

// Display names for the classifieds verticals (pt-first). The retail categories
// come from the dictionary; the verticals are named here until they earn i18n keys.
const VERTICAL_LABELS: Record<string, string> = {
  viaturas: 'Viaturas',
  imoveis: 'Imóveis',
  servicos: 'Serviços',
  empregos: 'Empregos',
  agro: 'Agro e Animais',
};

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

  // Per-category typed fields (verticals). Empty for plain retail categories.
  let attrDefs: CategoryAttribute[] = [];
  try {
    attrDefs = await getCategoryAttributes(slug);
  } catch {
    /* no attributes for this category */
  }

  // Read the active attribute filters off the URL: exact for text/enum,
  // `<key>_min` / `<key>_max` for numbers.
  const attributes: Record<string, AttributeFilter> = {};
  for (const a of attrDefs) {
    if (a.dataType === 'number') {
      const lo = one(sp[`${a.key}_min`]);
      const hi = one(sp[`${a.key}_max`]);
      const range: { min?: number; max?: number } = {};
      if (lo && Number.isFinite(Number(lo))) range.min = Number(lo);
      if (hi && Number.isFinite(Number(hi))) range.max = Number(hi);
      if (range.min !== undefined || range.max !== undefined) attributes[a.key] = range;
    } else {
      const v = one(sp[a.key]);
      if (v && v.trim() !== '') attributes[a.key] = v;
    }
  }

  let items: ProductListItem[] = [];
  let total = 0;
  try {
    const r = await searchProducts({
      category: slug,
      ...(sort ? { sort } : {}),
      ...(minPrice ? { minPrice: Number(minPrice) } : {}),
      ...(maxPrice ? { maxPrice: Number(maxPrice) } : {}),
      ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
      inStock,
    });
    items = r.items;
    total = r.total;
  } catch {
    /* empty */
  }

  const base = `/categoria/${slug}`;
  // Rebuild the query from all current params, minus the ones a chip removes —
  // so removing one filter keeps every other filter intact.
  const hrefWithout = (drop: string[]): string => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (drop.includes(k)) continue;
      const val = one(v);
      if (val !== undefined && val !== '') p.set(k, val);
    }
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const mt = (c: string): string => String(Math.round(Number(c) / 100));

  const chips: ActiveChip[] = [];
  if (minPrice || maxPrice) {
    chips.push({
      label: `${minPrice ? mt(minPrice) : '0'}–${maxPrice ? mt(maxPrice) : '∞'} MT`,
      removeHref: hrefWithout(['minPrice', 'maxPrice']),
    });
  }
  for (const a of attrDefs) {
    const f = attributes[a.key];
    if (f === undefined) continue;
    if (typeof f === 'string') {
      chips.push({ label: `${a.label}: ${f}`, removeHref: hrefWithout([a.key]) });
    } else {
      const range = `${f.min ?? ''}–${f.max ?? '∞'}`;
      chips.push({
        label: `${a.label}: ${range}`,
        removeHref: hrefWithout([`${a.key}_min`, `${a.key}_max`]),
      });
    }
  }
  if (inStock) chips.push({ label: t.search.in_stock_only, removeHref: hrefWithout(['inStock']) });

  const label = isCat(slug)
    ? (t.categories as Dictionary['categories'])[slug]
    : (VERTICAL_LABELS[slug] ?? slug);
  return (
    <SearchResults
      t={t}
      title={label}
      items={items}
      total={total}
      chips={chips}
      clearHref={base}
      lockedCategory={slug}
      attributes={attrDefs}
      crumbs={[
        { label: t.common.brand, href: '/' },
        { label: t.search.categories, href: '/' },
        { label },
      ]}
    />
  );
}

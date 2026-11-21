import type { Metadata } from 'next';
import { SearchResults, type ActiveChip, type CategoryChip } from '../../components/SearchResults';
import {
  getDistricts,
  getProvinces,
  searchProducts,
  type District,
  type ProductListItem,
  type Province,
} from '../../lib/api';
import { fill, getDictionary } from '../../lib/i18n/index';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

// Search pages get a descriptive title ("toyota em Moçambique — anúncios"),
// useful in browser tabs and shared links.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SP>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const q = (one(sp.q) ?? '').trim();
  const { t } = await getDictionary();
  return q ? { title: fill(t.search.page_title, { q }) } : {};
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { t } = await getDictionary();
  const q = one(sp.q) ?? '';
  const sort = one(sp.sort);
  const category = one(sp.category);
  const province = one(sp.province);
  const district = one(sp.district);
  const minPrice = one(sp.minPrice);
  const maxPrice = one(sp.maxPrice);
  const inStock = one(sp.inStock) === 'true';

  let provinces: Province[] = [];
  let districts: District[] = [];
  try {
    [provinces, districts] = await Promise.all([getProvinces(), getDistricts()]);
  } catch {
    /* location picker just hides */
  }

  let items: ProductListItem[] = [];
  let total = 0;
  let correctedQuery: string | null = null;
  let categoryCounts: { slug: string; name: string; count: number }[] = [];
  try {
    const r = await searchProducts({
      q,
      ...(sort ? { sort } : {}),
      ...(category ? { category } : {}),
      ...(province ? { province } : {}),
      ...(district ? { district } : {}),
      ...(minPrice ? { minPrice: Number(minPrice) } : {}),
      ...(maxPrice ? { maxPrice: Number(maxPrice) } : {}),
      inStock,
    });
    items = r.items;
    total = r.total;
    correctedQuery = r.correctedQuery ?? null;
    categoryCounts = r.categoryCounts ?? [];
  } catch {
    /* render as empty */
  }

  // Rebuild the query string, dropping one key — used to make each chip removable.
  const keep = (drop: string): string => {
    const p = new URLSearchParams();
    if (q && drop !== 'q') p.set('q', q);
    if (sort && drop !== 'sort') p.set('sort', sort);
    if (category && drop !== 'category') p.set('category', category);
    // Location is one chip: dropping it clears both province and district.
    if (province && drop !== 'province' && drop !== 'location') p.set('province', province);
    if (district && drop !== 'district' && drop !== 'location') p.set('district', district);
    if (minPrice && drop !== 'minPrice') p.set('minPrice', minPrice);
    if (maxPrice && drop !== 'maxPrice') p.set('maxPrice', maxPrice);
    if (inStock && drop !== 'inStock') p.set('inStock', 'true');
    const s = p.toString();
    return s ? `/pesquisa?${s}` : '/pesquisa';
  };

  const catLabel = (slug: string): string => (t.categories as Record<string, string>)[slug] ?? slug;

  // OLX-style refinement: "Todas (8) · Viaturas (5) · Imóveis (1)…".
  const withCategory = (slug: string | null): string => {
    const p = new URLSearchParams(keep('category').split('?')[1] ?? '');
    if (slug) p.set('category', slug);
    const qs = p.toString();
    return qs ? `/pesquisa?${qs}` : '/pesquisa';
  };
  const allCount = categoryCounts.reduce((n, c) => n + c.count, 0);
  const categoryChips: CategoryChip[] =
    categoryCounts.length > 1
      ? [
          {
            label: t.search.all_short,
            count: allCount,
            href: withCategory(null),
            active: !category,
          },
          ...categoryCounts.map((c) => ({
            label: catLabel(c.slug),
            count: c.count,
            href: withCategory(c.slug),
            active: category === c.slug,
          })),
        ]
      : [];
  const mt = (cents: string): string => String(Math.round(Number(cents) / 100));

  // Removing the price chip clears both bounds at once.
  const keepDropPrice = (): string => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (sort) p.set('sort', sort);
    if (category) p.set('category', category);
    if (province) p.set('province', province);
    if (district) p.set('district', district);
    if (inStock) p.set('inStock', 'true');
    const s = p.toString();
    return s ? `/pesquisa?${s}` : '/pesquisa';
  };

  const provinceName = (code: string): string =>
    provinces.find((pr) => pr.code === code)?.name ?? code;
  const districtName = (id: string): string => districts.find((d) => d.id === id)?.name ?? id;
  // The location chip shows the most specific choice (district, else province).
  const locationLabel = district ? districtName(district) : province ? provinceName(province) : '';

  const chips: ActiveChip[] = [];
  if (q) chips.push({ label: `“${q}”`, removeHref: keep('q') });
  if (category) chips.push({ label: catLabel(category), removeHref: keep('category') });
  if (locationLabel) chips.push({ label: `📍 ${locationLabel}`, removeHref: keep('location') });
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
      correctedQuery={correctedQuery}
      categoryChips={categoryChips}
      crumbs={[{ label: t.common.brand, href: '/' }, { label: t.search.crumb }]}
    />
  );
}

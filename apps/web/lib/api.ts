// Server-side data access for the storefront. Runs in Next server components,
// so it talks to the API over the private network, never from the browser.

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export interface Image {
  url: string;
  width: number;
  height: number;
  lqip?: string;
  alt?: string;
}
export interface VendorSummary {
  id: string;
  slug: string;
  displayName: string;
  isVerified: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  /** Contact channels — only populated on the product detail; null when hidden. */
  whatsapp?: string | null;
  phone?: string | null;
}
export interface ListingStats {
  views: number;
  contacts: number;
  shares: number;
}
export interface ProductListItem {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  compareAtCents?: number;
  discountPercent: number | null;
  image?: Image;
  ratingAvg: number | null;
  ratingCount: number;
  inStock: boolean;
  freeDelivery: boolean;
  location: string | null;
  postedAt: string | null;
  featured: boolean;
  attributes: Record<string, string>;
  vendor: VendorSummary;
}
export interface ProductVariant {
  id: string;
  sku: string;
  options: Record<string, string>;
  priceCents: number;
  compareAtCents?: number;
  stockQuantity: number;
  inStock: boolean;
}
export interface OptionGroup {
  name: string;
  values: { value: string; available: boolean }[];
}
export interface ProductDetail extends ProductListItem {
  category: { slug: string; name: string };
  description: string;
  attributes: Record<string, string>;
  images: Image[];
  variants: ProductVariant[];
  options: OptionGroup[];
  stats: ListingStats;
}

/** A filterable, typed field defined for a category (e.g. Viaturas → marca). */
export interface CategoryAttribute {
  key: string;
  label: string;
  dataType: 'text' | 'number' | 'boolean' | 'enum';
  options: string[] | null;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Server-side fetch with a single retry on a *transient* failure (a network
// error or a 5xx — e.g. the API briefly restarting), so a one-off blip doesn't
// blank a whole page. A 4xx (like 404) is a definitive answer and is surfaced
// immediately; the "API 404 for …" message shape is relied on by callers.
async function get<T>(path: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, {
        headers: { 'accept-language': 'pt' },
        // Always fresh in the local test env; production would cache per D-09.
        cache: 'no-store',
      });
    } catch (e) {
      lastErr = e; // connection error — the API may be restarting
      if (attempt === 0) await sleep(250);
      continue;
    }
    if (res.ok) return (await res.json()) as T;
    if (res.status < 500) throw new Error(`API ${res.status} for ${path}`);
    lastErr = new Error(`API ${res.status} for ${path}`);
    if (attempt === 0) await sleep(250);
  }
  throw lastErr;
}

export async function listProducts(): Promise<ProductListItem[]> {
  const data = await get<{ items: ProductListItem[] }>('/catalog/products');
  return data.items;
}

export async function getProduct(slug: string): Promise<ProductDetail> {
  return get<ProductDetail>(`/catalog/products/${encodeURIComponent(slug)}`);
}

export async function listProductsByVendor(
  slug: string,
): Promise<{ items: ProductListItem[]; vendor: VendorSummary | null }> {
  const data = await get<{ items: ProductListItem[] }>(
    `/catalog/products?vendor=${encodeURIComponent(slug)}&limit=48`,
  );
  // The vendor header is derived from the products themselves — there is no
  // vendor-detail endpoint yet, so we only show what the catalogue actually
  // knows (name, verified, rating). No invented bio or location.
  return { items: data.items, vendor: data.items[0]?.vendor ?? null };
}

/** A per-attribute filter value: an exact string (text/enum) or a numeric range. */
export type AttributeFilter = string | { min?: number; max?: number };

export interface SearchParams {
  q?: string;
  category?: string;
  sort?: string;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  /** Per-category attribute filters, e.g. { marca: 'Honda', ano: { min: 2015 } }. */
  attributes?: Record<string, AttributeFilter>;
}

export async function searchProducts(
  p: SearchParams,
): Promise<{ items: ProductListItem[]; total: number }> {
  const qs = new URLSearchParams();
  if (p.q) qs.set('q', p.q);
  if (p.category) qs.set('category', p.category);
  if (p.sort) qs.set('sort', p.sort);
  if (p.inStock) qs.set('inStock', 'true');
  if (p.minPrice !== undefined) qs.set('minPrice', String(p.minPrice));
  if (p.maxPrice !== undefined) qs.set('maxPrice', String(p.maxPrice));
  if (p.attributes && Object.keys(p.attributes).length > 0) {
    qs.set('attributes', JSON.stringify(p.attributes));
  }
  const data = await get<{ items: ProductListItem[]; total: number }>(
    `/catalog/products?${qs.toString()}`,
  );
  return { items: data.items, total: data.total };
}

export interface VendorReview {
  id: string;
  author: string;
  rating: number;
  comment: string | null;
  productSlug: string | null;
  createdAt: string;
}
export interface VendorReviewList {
  items: VendorReview[];
  summary: { ratingAvg: number | null; ratingCount: number };
}

/** Published reviews + rating summary for a vendor. */
export async function getVendorReviews(vendorId: string): Promise<VendorReviewList> {
  try {
    return await get<VendorReviewList>(`/vendors/${encodeURIComponent(vendorId)}/reviews`);
  } catch {
    return { items: [], summary: { ratingAvg: null, ratingCount: 0 } };
  }
}

export interface ServedAd {
  id: string;
  imageUrl: string;
  headline: string | null;
  advertiser: string;
}

/** Example rate card (cents/day) per placement, for the booking form. */
export async function getAdPlans(): Promise<Record<string, number>> {
  try {
    return await get<Record<string, number>>('/ads/plans');
  } catch {
    return { leaderboard: 50000, mpu: 30000, inline: 40000 };
  }
}

/** Serve a live ad creative for a slot (counts an impression). Null → house ad. */
export async function getAd(placement: string, category?: string): Promise<ServedAd | null> {
  try {
    const qs = new URLSearchParams({ placement });
    if (category) qs.set('category', category);
    const data = await get<{ ad: ServedAd | null }>(`/ads?${qs.toString()}`);
    return data.ad;
  } catch {
    return null;
  }
}

/** Filterable attributes for a category — drives the per-vertical filter rail. */
export async function getCategoryAttributes(slug: string): Promise<CategoryAttribute[]> {
  try {
    return await get<CategoryAttribute[]>(
      `/catalog/categories/${encodeURIComponent(slug)}/attributes`,
    );
  } catch {
    return [];
  }
}

export { API_URL };

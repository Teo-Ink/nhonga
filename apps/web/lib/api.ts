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
  description: string;
  attributes: Record<string, string>;
  images: Image[];
  variants: ProductVariant[];
  options: OptionGroup[];
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'accept-language': 'pt' },
    // Always fresh in the local test env; production would cache per D-09.
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} for ${path}`);
  }
  return (await res.json()) as T;
}

export async function listProducts(): Promise<ProductListItem[]> {
  const data = await get<{ items: ProductListItem[] }>('/catalog/products');
  return data.items;
}

export async function getProduct(slug: string): Promise<ProductDetail> {
  return get<ProductDetail>(`/catalog/products/${encodeURIComponent(slug)}`);
}

export { API_URL };

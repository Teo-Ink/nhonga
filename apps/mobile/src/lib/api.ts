import * as SecureStore from 'expo-secure-store';

// The API base URL. Set EXPO_PUBLIC_API_URL to your machine's LAN address when
// running on a physical device (localhost points at the phone itself), e.g.
// EXPO_PUBLIC_API_URL="http://192.168.1.10:3000".
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const TOKEN_KEY = 'nhonga_session';

// ── Types (mirror the catalogue API) ──────────────────────────────
export interface ProductImage {
  url: string;
  alt: string | null;
}
export interface ProductListItem {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  compareAtCents: number | null;
  discountPercent: number | null;
  image: ProductImage | null;
  inStock: boolean;
  location: string | null;
  vendor: { displayName: string };
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
  description: string | null;
  images: ProductImage[];
  attributes: Record<string, string>;
  ratingAvg: number;
  ratingCount: number;
  vendor: { displayName: string; slug: string; whatsapp: string | null; phone: string | null };
  variants: ProductVariant[];
  options: OptionGroup[];
  stats: { views: number; contacts: number; shares: number };
}
export interface AuthUser {
  id: string;
  displayName: string;
  phoneE164: string;
}
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function get<T>(path: string, auth = false): Promise<T> {
  const headers: Record<string, string> = { 'accept-language': 'pt' };
  if (auth) {
    const token = await getToken();
    if (token) headers['authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function post<T>(path: string, body: unknown, auth = false): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'accept-language': 'pt',
  };
  if (auth) {
    const token = await getToken();
    if (token) headers['authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; detail?: string };
  if (!res.ok) throw new Error(data.detail ?? data.message ?? `POST ${path} → ${res.status}`);
  return data;
}

// ── Session token (SecureStore) ───────────────────────────────────
export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}
export async function setToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}
export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// ── Endpoints ─────────────────────────────────────────────────────
export function listProducts(limit = 48, q?: string): Promise<{ items: ProductListItem[] }> {
  const query = q && q.trim() ? `&q=${encodeURIComponent(q.trim())}` : '';
  return get(`/catalog/products?limit=${limit}${query}`);
}

// AI search: derive a catalogue query (+ category) from a photo (or text).
export interface AiSearchResult {
  query: string;
  category?: string;
  configured: boolean;
}
export function aiSearch(payload: { text?: string; image?: string }): Promise<AiSearchResult> {
  return post('/assistant/search-query', payload);
}
export function getProduct(slug: string): Promise<ProductDetail> {
  return get(`/catalog/products/${encodeURIComponent(slug)}`);
}

// ── Seller: my shop + listings (requires a session) ───────────────
export interface MineItem {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  imageUrl: string | null;
  status: string;
  inStock: boolean;
  views: number;
  contacts: number;
}
export interface MineResponse {
  shop: { slug: string; displayName: string } | null;
  stats: {
    active: number;
    sold: number;
    views: number;
    contacts: number;
    ratingAvg: number | null;
    ratingCount: number;
  };
  items: MineItem[];
}
export function myListings(): Promise<MineResponse> {
  return get('/catalog/mine/products', true);
}
export async function setListingStatus(
  id: string,
  status: 'active' | 'sold' | 'archived',
): Promise<void> {
  const token = await getToken();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  await fetch(`${API_URL}/catalog/products/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status }),
  });
}
export async function removeListing(id: string): Promise<void> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['authorization'] = `Bearer ${token}`;
  await fetch(`${API_URL}/catalog/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });
}
export function requestOtp(phone: string): Promise<{ challengeId: string; devCode?: string }> {
  return post('/auth/otp/request', { phone });
}
export function verifyOtp(
  challengeId: string,
  code: string,
): Promise<{ sessionToken: string; user: AuthUser }> {
  return post('/auth/otp/verify', { challengeId, code });
}
export function me(): Promise<{ user: AuthUser | null }> {
  return get('/auth/me', true);
}
export function chat(messages: ChatMessage[]): Promise<{ reply: string; configured: boolean }> {
  return post('/assistant/chat', { messages });
}

// ── Favourites (server-side, requires a session) ──────────────────
export interface FavoriteItem {
  productId: string;
  slug: string;
  savedPriceCents: number;
}
export function listFavorites(): Promise<FavoriteItem[]> {
  return get('/favorites', true);
}

// ── Push token registration (signed-in) ───────────────────────────
export function registerPushToken(token: string, platform: string): Promise<{ ok: boolean }> {
  return post('/notifications/push-token', { token, platform }, true);
}
export async function unregisterPushToken(token: string): Promise<void> {
  await post('/notifications/push-token/remove', { token }, true).catch(() => undefined);
}

// ── Saved searches (SMS/push alerts) ──────────────────────────────
export interface SavedSearch {
  id: string;
  label: string;
  href: string;
  createdAt: string;
  lastRunAt: string | null;
}
export function listSavedSearches(phoneE164: string): Promise<SavedSearch[]> {
  return get(`/saved-searches?phone=${encodeURIComponent(phoneE164)}`);
}
export function createSavedSearch(input: {
  phone: string;
  label: string;
  href: string;
  query: Record<string, unknown>;
}): Promise<{ id: string }> {
  return post('/saved-searches', input);
}
export async function removeSavedSearch(id: string): Promise<void> {
  await fetch(`${API_URL}/saved-searches/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(
    () => undefined,
  );
}
export function addFavorite(productId: string): Promise<{ ok: true }> {
  return post('/favorites', { productId }, true);
}
export async function removeFavorite(productId: string): Promise<void> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['authorization'] = `Bearer ${token}`;
  await fetch(`${API_URL}/favorites/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    headers,
  }).catch(() => undefined);
}
/** Record an engagement event on a listing (contact / share). Best-effort. */
export function recordEvent(slug: string, type: 'contact' | 'share' | 'view'): void {
  void fetch(`${API_URL}/catalog/products/${encodeURIComponent(slug)}/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type }),
  }).catch(() => {});
}

export function formatMZN(cents: number): string {
  const neg = cents < 0;
  const n = Math.abs(Math.round(cents));
  const int = Math.floor(n / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dec = (n % 100).toString().padStart(2, '0');
  return `${neg ? '-' : ''}${int},${dec} MT`;
}

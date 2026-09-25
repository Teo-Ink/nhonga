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
export interface ProductDetail extends ProductListItem {
  description: string | null;
  images: ProductImage[];
  attributes: Record<string, string>;
  ratingAvg: number;
  ratingCount: number;
  vendor: { displayName: string; slug: string };
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
export function listProducts(limit = 48): Promise<{ items: ProductListItem[] }> {
  return get(`/catalog/products?limit=${limit}`);
}
export function getProduct(slug: string): Promise<ProductDetail> {
  return get(`/catalog/products/${encodeURIComponent(slug)}`);
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

export function formatMZN(cents: number): string {
  const neg = cents < 0;
  const n = Math.abs(Math.round(cents));
  const int = Math.floor(n / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dec = (n % 100).toString().padStart(2, '0');
  return `${neg ? '-' : ''}${int},${dec} MT`;
}

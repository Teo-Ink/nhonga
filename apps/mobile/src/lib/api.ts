import * as SecureStore from 'expo-secure-store';
import { assertReleaseApiUrl } from './release-config';

// The API base URL. Set EXPO_PUBLIC_API_URL to your machine's LAN address when
// running on a physical device (localhost points at the phone itself), e.g.
// EXPO_PUBLIC_API_URL="http://192.168.1.10:3000".
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
/** Versioned API base (P2-11): every call goes to /v1. */
const API = `${API_URL}/v1`;

assertReleaseApiUrl(API_URL, typeof __DEV__ !== 'undefined' ? __DEV__ : true);

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
  featured?: boolean;
  views?: number;
  bannerUrl?: string | null;
  category?: { slug: string; name: string };
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
  description: string | null;
  images: ProductImage[];
  attributes: Record<string, string>;
  ratingAvg: number;
  ratingCount: number;
  vendor: { displayName: string; slug: string; contact?: SellerChannels };
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
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function post<T>(
  path: string,
  body: unknown,
  auth = false,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'accept-language': 'pt',
    ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
  };
  if (auth) {
    const token = await getToken();
    if (token) headers['authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; detail?: string };
  if (!res.ok) throw new Error(data.detail ?? data.message ?? `POST ${path} → ${res.status}`);
  return data;
}

// ── Session token (SecureStore) ───────────────────────────────────
// SecureStore has no web implementation, so on Expo web the setItem/getItem
// calls throw and the token would be lost. We keep an in-memory fallback so the
// session at least works within a running web session (it still won't survive a
// full page reload there — use a native build for persistent sessions).
let memToken: string | null = null;

export async function getToken(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(TOKEN_KEY);
    if (stored) return stored;
  } catch {
    /* secure store unavailable (e.g. web) — fall back to memory */
  }
  return memToken;
}
export async function setToken(token: string): Promise<void> {
  memToken = token;
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    /* ignore — kept in memory */
  }
}
export async function clearToken(): Promise<void> {
  memToken = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// ── Endpoints ─────────────────────────────────────────────────────
export type SortKey = 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating';
export interface ListOptions {
  limit?: number;
  q?: string;
  category?: string;
  vendor?: string;
  sort?: SortKey;
  minPriceCents?: number;
  maxPriceCents?: number;
}
export function listProducts(opts: ListOptions = {}): Promise<{ items: ProductListItem[] }> {
  const p = new URLSearchParams();
  p.set('limit', String(opts.limit ?? 48));
  if (opts.q && opts.q.trim()) p.set('q', opts.q.trim());
  if (opts.category) p.set('category', opts.category);
  if (opts.vendor) p.set('vendor', opts.vendor);
  if (opts.sort && opts.sort !== 'relevance') p.set('sort', opts.sort);
  if (typeof opts.minPriceCents === 'number') p.set('minPrice', String(opts.minPriceCents));
  if (typeof opts.maxPriceCents === 'number') p.set('maxPrice', String(opts.maxPriceCents));
  return get(`/catalog/products?${p.toString()}`);
}

// Public seller storefront details (header, rating, counts, contact).
export interface Shop {
  slug: string;
  displayName: string;
  isVerified: boolean;
  isPro: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  location: string | null;
  memberSince: string;
  activeCount: number;
  soldCount: number;
  contact?: SellerChannels;
}

/** Channels a seller offers, without the digits (PRIV-01). */
export interface SellerChannels {
  whatsapp: boolean;
  phone: boolean;
  hint: string | null;
}
export interface SellerNumbers {
  whatsapp: string | null;
  phone: string | null;
}
/**
 * The seller's numbers, asked for when the user taps WhatsApp or Ligar. The
 * API counts it as a contact and limits how many a person may ask for.
 * Returns null when it cannot be shown now (limit reached or no network).
 */
export async function revealContact(
  target: { productSlug: string } | { vendorSlug: string },
): Promise<SellerNumbers | null> {
  try {
    return await post<SellerNumbers>('/catalog/contacts', target);
  } catch {
    return null;
  }
}
export function getShop(slug: string): Promise<Shop | null> {
  return get(`/catalog/shops/${encodeURIComponent(slug)}`);
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
  featured?: boolean;
  featuredUntil?: string | null;
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
  await fetch(`${API}/catalog/products/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status }),
  });
}
export async function removeListing(id: string): Promise<void> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['authorization'] = `Bearer ${token}`;
  await fetch(`${API}/catalog/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });
}
// ── AI Banner Studio ──────────────────────────────────────────────
export interface BannerQuota {
  used: number;
  limit: number;
  remaining: number;
  isPro: boolean;
  pointCost: number;
}
export interface BannerVariant {
  id: string;
  preset: string;
  ratio: string;
  spec: { headline: string; subheadline: string; cta: string };
}
export interface GenerateBannerResult {
  variants: BannerVariant[];
  aiUsed: boolean;
  quota: BannerQuota;
}
/** Public SVG url for a banner (native renders it via expo-image). */
export function bannerSvgUrl(id: string): string {
  return `${API}/banners/${encodeURIComponent(id)}.svg`;
}
export function bannerQuota(): Promise<BannerQuota> {
  return get('/banners/quota', true);
}
export function generateBanner(input: {
  productId: string;
  ratio: string;
  preset: string;
  prompt?: string;
}): Promise<GenerateBannerResult> {
  return post('/banners/generate', input, true);
}
export function applyBanner(bannerId: string): Promise<{ bannerId: string }> {
  return post('/banners/apply', { bannerId }, true);
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

/** Delete the signed-in account (P0-06). Immediate; every session ends. */
export async function deleteAccount(): Promise<void> {
  const token = await getToken();
  const res = await fetch(`${API}/auth/me`, {
    method: 'DELETE',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Não foi possível eliminar a conta. Tente de novo.');
}

export type ReportReason =
  | 'fraud'
  | 'prohibited'
  | 'spam'
  | 'wrong_category'
  | 'offensive'
  | 'other';

/** Report a listing to the Nhonga team (P0-18). Works without an account. */
export function reportListing(slug: string, reason: ReportReason): Promise<{ ok: true }> {
  return post(`/catalog/products/${encodeURIComponent(slug)}/reports`, { reason }, true);
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

// ── Seller wallet (balance + loyalty points) ──────────────────────
export interface WalletPackage {
  id: string;
  name: string;
  priceCents: number;
  balanceCents: number;
  points: number;
}
export interface WalletTx {
  id: string;
  kind: string;
  amountCents: number;
  points: number;
  description: string;
  createdAt: string;
}
export interface WalletView {
  hasShop: boolean;
  shopName: string | null;
  balanceCents: number;
  points: number;
  isPro: boolean;
  proUntil: string | null;
  transactions: WalletTx[];
}
export function getWallet(): Promise<WalletView> {
  return get('/wallet', true);
}
export function getWalletPackages(): Promise<WalletPackage[]> {
  return get('/wallet/packages');
}
export function topupWallet(amountCents: number, key?: string): Promise<WalletView> {
  return post('/wallet/topup', { amountCents }, true, key);
}
export function purchasePackage(packageId: string, key?: string): Promise<WalletView> {
  return post('/wallet/purchase', { packageId }, true, key);
}
export function subscribePro(key?: string): Promise<WalletView> {
  return post('/wallet/pro', {}, true, key);
}
export interface BoostPlan {
  code: string;
  name: string;
  kind: 'feature' | 'bump';
  priceCents: number;
  pointsCost: number;
  durationDays: number;
}
export interface BoostResult {
  wallet: WalletView;
  planName: string;
  endsAt: string | null;
}
export function getWalletPlans(): Promise<BoostPlan[]> {
  return get('/wallet/plans');
}
export function boostListing(
  productId: string,
  planCode: string,
  key?: string,
): Promise<BoostResult> {
  return post('/wallet/boost', { productId, planCode }, true, key);
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
// Alerts belong to the signed-in account and go to its verified number; the
// API ignores any phone sent in the body (P0-02/SEC-09).
export function listSavedSearches(_phoneE164?: string): Promise<SavedSearch[]> {
  return get('/saved-searches', true);
}
export function createSavedSearch(input: {
  phone?: string;
  label: string;
  href: string;
  query: Record<string, unknown>;
}): Promise<{ id: string }> {
  const { label, href, query } = input;
  return post('/saved-searches', { label, href, query }, true);
}
export async function removeSavedSearch(id: string): Promise<void> {
  const token = await getToken();
  await fetch(`${API}/saved-searches/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  }).catch(() => undefined);
}
export function addFavorite(productId: string): Promise<{ ok: true }> {
  return post('/favorites', { productId }, true);
}
export async function removeFavorite(productId: string): Promise<void> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['authorization'] = `Bearer ${token}`;
  await fetch(`${API}/favorites/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    headers,
  }).catch(() => undefined);
}
/** Record an engagement event on a listing (contact / share). Best-effort. */
export function recordEvent(slug: string, type: 'contact' | 'share' | 'view'): void {
  void fetch(`${API}/catalog/products/${encodeURIComponent(slug)}/events`, {
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

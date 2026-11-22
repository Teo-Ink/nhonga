import { headers } from 'next/headers';

// Public origin and indexing policy (WEB-02).
//
// SITE_URL (e.g. https://nhonga.co.mz) is the canonical origin used in
// sitemaps, canonical links and Open Graph URLs. Without it the origin is
// taken from the request (the load balancer's forwarded host and protocol).
//
// Search engines may index the site only when SITE_INDEXABLE=1, which only
// production sets. Staging, previews and local builds stay out of Google.

export function isIndexable(): boolean {
  return process.env.SITE_INDEXABLE === '1';
}

export async function siteOrigin(): Promise<string> {
  const configured = process.env.SITE_URL?.replace(/\/+$/, '');
  if (configured) return configured;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3001';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

/** Category slugs that have a /categoria/[slug] page. */
export const CATEGORY_SLUGS = [
  'moda',
  'electronica',
  'casa',
  'alimentacao',
  'beleza',
  'telemoveis',
  'viaturas',
  'imoveis',
  'empregos',
  'servicos',
  'eventos',
] as const;

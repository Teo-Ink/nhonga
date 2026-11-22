import type { MetadataRoute } from 'next';
import { listProducts } from '../lib/api';
import { CATEGORY_SLUGS, siteOrigin } from '../lib/site';

export const dynamic = 'force-dynamic';

// Home, help pages, every category and the active listings and their shops.
// If the API is unreachable the static part is still served.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${origin}/`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    ...['/ajuda', '/seguranca', '/termos', '/privacidade', '/compra-e-vendas'].map((p) => ({
      url: `${origin}${p}`,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
    ...CATEGORY_SLUGS.map((slug) => ({
      url: `${origin}/categoria/${slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];

  try {
    const products = await listProducts();
    const shops = new Set<string>();
    for (const p of products) {
      entries.push({
        url: `${origin}/produto/${encodeURIComponent(p.slug)}`,
        ...(p.postedAt ? { lastModified: new Date(p.postedAt) } : {}),
        changeFrequency: 'weekly',
        priority: 0.6,
      });
      if (p.vendor?.slug) shops.add(p.vendor.slug);
    }
    for (const slug of shops) {
      entries.push({
        url: `${origin}/loja/${encodeURIComponent(slug)}`,
        changeFrequency: 'weekly',
        priority: 0.4,
      });
    }
  } catch {
    // API down: serve the static entries only.
  }
  return entries;
}

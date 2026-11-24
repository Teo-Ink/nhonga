import type { MetadataRoute } from 'next';
import { isIndexable, siteOrigin } from '../lib/site';

// Rendered per request so one image serves staging (blocked) and production.
export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!isIndexable()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  const origin = await siteOrigin();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/conta',
          '/mensagens',
          '/pagamento',
          '/vender',
          '/entrar',
          '/favoritos',
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}

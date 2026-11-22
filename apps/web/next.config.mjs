// Mirrors lib/demo.ts: on in `next dev`, off in production builds unless
// NEXT_PUBLIC_DEMO_MODE=1.
const demoFlag = process.env.NEXT_PUBLIC_DEMO_MODE;
const isDemo =
  demoFlag === '1' ||
  demoFlag === 'true' ||
  (demoFlag === undefined && process.env.NODE_ENV !== 'production');

// Remote hosts the image optimizer may fetch from. Listing photos are served by
// Nhonga itself (/api/media), so production needs none unless IMAGE_HOSTS lists
// e.g. the CDN domain. A wildcard would let anyone use our server to fetch and
// resize arbitrary images.
const imageHosts = (process.env.IMAGE_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);
if (isDemo) imageHosts.push('live.staticflickr.com'); // seed sample photos

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: imageHosts.map((hostname) => ({ protocol: 'https', hostname })),
    // The /ph fallback placeholder is a local route carrying a query string
    // (?c=&t=). Declaring it satisfies next/image's localPatterns requirement
    // (advisory now, required in Next 16). Omitting `search` allows any query.
    localPatterns: [{ pathname: '/ph' }, { pathname: '/api/media/**' }],
    // The demo product images are self-generated SVG placeholders served from
    // /ph. We generate the SVG ourselves, so allowing it is safe here.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // @nhonga/shared ships ESM from dist; let Next transpile the workspace package.
  transpilePackages: ['@nhonga/shared'],
  async redirects() {
    return [
      // Selling starts by publishing an ad (OLX-style); the shop is created
      // with the first listing. The old multi-step onboarding saved nothing.
      { source: '/vender/comecar', destination: '/vender/novo', permanent: false },
      // Outside demo mode, promotions and "Loja Pro" are bought from the wallet
      // on the seller dashboard; these older pages used simulated payments.
      ...(isDemo
        ? []
        : [
            { source: '/vender/promover', destination: '/vender', permanent: false },
            { source: '/vender/verificar', destination: '/vender', permanent: false },
          ]),
    ];
  },
};
export default nextConfig;

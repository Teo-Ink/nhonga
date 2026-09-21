/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The storefront reads the API server-side; allow remote product images from
  // the seed placeholders. In production these become the CloudFront domain.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    // The demo product images are self-generated SVG placeholders served from
    // /ph. We generate the SVG ourselves, so allowing it is safe here.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // @nhonga/shared ships ESM from dist; let Next transpile the workspace package.
  transpilePackages: ['@nhonga/shared'],
};
export default nextConfig;

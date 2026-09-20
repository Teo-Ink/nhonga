/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The storefront reads the API server-side; allow remote product images from
  // the seed placeholders. In production these become the CloudFront domain.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  // @nhonga/shared ships ESM from dist; let Next transpile the workspace package.
  transpilePackages: ['@nhonga/shared'],
};
export default nextConfig;

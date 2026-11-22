// Security headers for every page and route (SEC-03). Kept in a plain .mjs
// module so next.config.mjs and the tests share one definition.
//
// Scripts: Next.js App Router streams inline <script> chunks and the layout has
// a small inline theme boot script, so script-src allows 'unsafe-inline' but no
// other origin. Third-party script hosts are blocked outright. Moving to nonces
// needs every page rendered dynamically; tracked as a follow-up.

/** @param {{ dev?: boolean, imageHosts?: string[] }} [opts] */
export function contentSecurityPolicy({ dev = false, imageHosts = [] } = {}) {
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    // Listing photos come through Nhonga (/api/media, /_next/image); data: and
    // blob: cover inline SVG placeholders and local previews before upload.
    // IMAGE_HOSTS (a CDN, or the demo photo host) are allowed explicitly.
    'img-src': ["'self'", 'data:', 'blob:', ...imageHosts.map((h) => `https://${h}`)],
    'media-src': ["'self'"],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(dev ? ['ws:'] : [])],
    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}

/** @param {{ dev?: boolean, imageHosts?: string[] }} [opts] */
export function securityHeaders({ dev = false, imageHosts = [] } = {}) {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy({ dev, imageHosts }) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Camera (photos), microphone (voice search) and location stay available
    // to Nhonga itself; everything else is off.
    {
      key: 'Permissions-Policy',
      value:
        'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), interest-cohort=()',
    },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
}

// HSTS is added by middleware.ts, only on HTTPS requests.

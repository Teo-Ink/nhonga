// Security headers for every page and route (SEC-03). Kept in a plain .mjs
// module so next.config.mjs and the tests share one definition.
//
// Scripts (SEC-10 / P2-07): every page gets a fresh nonce from middleware.ts.
// Only scripts carrying it run ('strict-dynamic' lets them load Next's own
// chunks); an injected <script> without the nonce is refused. Pages are
// therefore rendered per request. Without a nonce (a response that did not
// pass through the middleware) the policy falls back to 'unsafe-inline'.

/** @param {{ dev?: boolean, imageHosts?: string[], nonce?: string }} [opts] */
export function contentSecurityPolicy({ dev = false, imageHosts = [], nonce } = {}) {
  const scripts = nonce
    ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]
    : ["'self'", "'unsafe-inline'"];
  const directives = {
    'default-src': ["'self'"],
    'script-src': [...scripts, ...(dev ? ["'unsafe-eval'"] : [])],
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
  // The page CSP (with its nonce) is set per request by middleware.ts; this
  // static one covers what the middleware does not see (static files).
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

/**
 * Image hosts the CSP allows: IMAGE_HOSTS (the media CDN), plus the demo photo
 * host when the demo catalogue is on. Shared by next.config.mjs and
 * middleware.ts so both policies agree.
 * @param {Record<string, string | undefined>} env
 */
export function imageHostsFromEnv(env) {
  const hosts = (env.IMAGE_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  const flag = env.NEXT_PUBLIC_DEMO_MODE;
  const demo =
    flag === '1' || flag === 'true' || (flag === undefined && env.NODE_ENV !== 'production');
  if (demo) hosts.push('live.staticflickr.com'); // seed sample photos
  return hosts;
}

/**
 * Cross-site request check for the BFF (PRE-03). A browser sends Origin on
 * every cross-site POST/PUT/PATCH/DELETE; when it names another site, the
 * request did not come from our pages. The session cookie is already
 * SameSite=Lax, which stops this in current browsers: this is the second lock.
 * Requests without Origin (older browsers on same-origin forms, server-to-
 * server calls, the mobile app) are left to the cookie rule.
 *
 * @param {{ method: string, path: string, origin: string | null, host: string | null }} req
 * @returns {boolean} true when the request must be refused
 */
export function isCrossSiteWrite(req) {
  if (!req.path.startsWith('/api/')) return false;
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return false;
  if (!req.origin || !req.host) return false;
  // An Origin is "scheme://host[:port]"; anything else ("null", junk) is not us.
  const m = /^https?:\/\/([^/?#]+)$/i.exec(req.origin);
  return !m || m[1].toLowerCase() !== req.host.toLowerCase();
}

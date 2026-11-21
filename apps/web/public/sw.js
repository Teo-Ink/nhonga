/* Nhonga service worker — "modo leve" for 3G / low-end Android.
 *
 * Goals: make the app installable, work offline (at least a friendly fallback),
 * and avoid re-downloading the shell and images on flaky/expensive data.
 *
 * Dev-safe by design: it never touches Next.js internals (/_next/, HMR) or
 * non-GET/cross-origin requests, so `next dev` and hot-reload keep working.
 */
const VERSION = 'nhonga-v2';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Let Claude / the page trigger an immediate update.
self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

function isBypassed(url, request) {
  if (request.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true;
  // Next.js dev/runtime internals and API — always go to network.
  if (url.pathname.startsWith('/_next/')) return true;
  if (url.pathname.startsWith('/api/')) return true;
  // Range requests (video/audio seeking) expect 206 partial responses, which
  // the Cache API cannot store or replay. Let the browser handle them natively.
  if (request.headers.has('range')) return true;
  return false;
}

// Cacheable same-origin static media we control (icons, hero, brand, uploads).
function isStaticAsset(url) {
  // No video here: browsers fetch media with Range requests (bypassed above),
  // and caching whole MP4s would eat the storage this worker exists to save.
  return /\.(png|jpg|jpeg|webp|avif|svg|gif|ico|woff2?)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (isBypassed(url, request)) return;

  // Page navigations: network-first, fall back to cache, then offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Static assets: stale-while-revalidate (instant from cache, refresh in bg).
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(VERSION).then((cache) =>
        cache.match(request).then((hit) => {
          const network = fetch(request)
            .then((res) => {
              if (res && res.status === 200) cache.put(request, res.clone());
              return res;
            })
            // Offline with nothing cached: respondWith() must still receive a
            // Response, never undefined, or the fetch throws a TypeError.
            .catch(() => hit || Response.error());
          return hit || network;
        }),
      ),
    );
  }
});

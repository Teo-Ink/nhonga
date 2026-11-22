import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy, imageHostsFromEnv } from './lib/security-headers.mjs';

// Per-request Content-Security-Policy with a nonce (SEC-10 / P2-07), and HSTS
// when the request reached us over HTTPS (SEC-03; the ALB sets
// x-forwarded-proto, so turning HTTPS on needs no code change).
//
// Next.js reads the nonce from the request's CSP header and puts it on its own
// scripts; the layout puts it on the theme boot script (x-nonce).
const HSTS_VALUE = 'max-age=31536000; includeSubDomains';
const imageHosts = imageHostsFromEnv({
  IMAGE_HOSTS: process.env.IMAGE_HOSTS,
  NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
  NODE_ENV: process.env.NODE_ENV,
});
const dev = process.env.NODE_ENV !== 'production';

export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy({ dev, imageHosts, nonce });

  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  if (req.headers.get('x-forwarded-proto') === 'https') {
    res.headers.set('Strict-Transport-Security', HSTS_VALUE);
  }
  return res;
}

export const config = {
  // Pages and route handlers; static files and prefetches need no nonce.
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|icons/|fonts/).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

import { NextResponse, type NextRequest } from 'next/server';

// HSTS only when the request reached us over HTTPS (SEC-03). The ALB sets
// x-forwarded-proto; while staging is plain HTTP, no HSTS is sent, so turning
// HTTPS on later needs no code change (see docs/runbooks/https.md).
const HSTS_VALUE = 'max-age=31536000; includeSubDomains';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (req.headers.get('x-forwarded-proto') === 'https') {
    res.headers.set('Strict-Transport-Security', HSTS_VALUE);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

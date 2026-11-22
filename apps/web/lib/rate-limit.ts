// Per-visitor limits for the few BFF routes where abuse costs money (each OTP
// request sends a paid SMS — "SMS pumping" fraud). In memory, per web server.
// The visitor is identified by the first X-Forwarded-For address set by the
// load balancer / platform in front of Next. Mozambican mobile networks share
// public IPs (CGNAT), so limits are generous; the API also limits per phone.

const hits = new Map<string, { count: number; resetAt: number }>();
let lastSweep = 0;

export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  return (xff?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown').slice(0, 64);
}

/** Returns seconds to wait when over `limit` per `windowMs`, else 0. */
export function overLimit(key: string, limit: number, windowMs: number, now = Date.now()): number {
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }
  const e = hits.get(key);
  if (!e || e.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  e.count += 1;
  return e.count > limit ? Math.ceil((e.resetAt - now) / 1000) : 0;
}

export function tooMany(retryAfterSec: number): Response {
  return Response.json(
    {
      status: 429,
      title: 'Too Many Requests',
      detail: 'Demasiados pedidos. Aguarde alguns minutos e tente de novo.',
    },
    { status: 429, headers: { 'retry-after': String(retryAfterSec) } },
  );
}

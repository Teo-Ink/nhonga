// Who is the visitor (PRE-02).
//
// Behind the load balancer, X-Forwarded-For is "<whatever the client sent>,
// <address the load balancer saw>". Only the entries appended by our own
// proxies can be trusted, so the visitor is counted from the RIGHT: with one
// proxy in front (the ALB) it is the last entry. Reading the first entry, as
// before, let anyone pick a new "address" per request and walk past the
// per-visitor limits (SMS pumping).
//
// TRUSTED_PROXY_HOPS is the number of proxies we run in front of the site
// (1 = ALB; 2 = CDN + ALB).

const IP = /^[0-9a-fA-F:.]{3,45}$/;

export function trustedHops(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.TRUSTED_PROXY_HOPS ?? '1');
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 1;
}

/** The visitor's address from an X-Forwarded-For value, or null. */
export function clientIpFromXff(
  xff: string | null | undefined,
  hops = trustedHops(),
): string | null {
  if (!xff) return null;
  const parts = xff
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const ip = parts[parts.length - hops];
  return ip && IP.test(ip) ? ip : null;
}

/**
 * Header that tells the API who the visitor is. The site calls the API from
 * its own servers, so without it the API sees every visitor as one address
 * and its per-visitor limits (sign-in, reports, complaints, seller numbers)
 * become one shared quota for the whole site. The API is only reachable
 * directly from inside our network, and through the load balancer the real
 * address is appended after anything a client sends, so this cannot be forged
 * from outside.
 */
export async function forwardedFor(): Promise<Record<string, string>> {
  try {
    const { headers } = await import('next/headers');
    const ip = clientIpFromXff((await headers()).get('x-forwarded-for'));
    return ip ? { 'x-forwarded-for': ip } : {};
  } catch {
    // Outside a request (build, background work): nothing to forward.
    return {};
  }
}

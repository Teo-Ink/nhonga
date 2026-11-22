import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Fixed-window request limiter, in memory (per API instance). Dependency-free.
 *
 * Who is a "client": the session (Bearer token) when there is one, otherwise
 * the IP. Most traffic arrives from the web BFF's server, so an IP-only limit
 * would throttle every visitor at once; keying signed-in traffic by session
 * avoids that, and the IP limit mainly guards direct hits on the public API.
 * Mozambican mobile networks put many users behind one IP (CGNAT), so the IP
 * budget is generous.
 *
 * Gateway webhooks and health checks are never limited: refusing a payment
 * callback would only delay a seller's credit.
 */

export interface RateLimitRule {
  /** Requests allowed per window. */
  readonly limit: number;
  readonly windowMs: number;
}

export interface RateLimitOptions {
  readonly perSession: RateLimitRule;
  readonly perIp: RateLimitRule;
  /** Paths that are never limited (prefix match). */
  readonly exempt: readonly string[];
  readonly now?: () => number;
}

export const DEFAULT_RATE_LIMITS: RateLimitOptions = {
  perSession: { limit: 300, windowMs: 60_000 },
  perIp: { limit: 1200, windowMs: 60_000 },
  exempt: ['/checkout/webhooks/', '/webhooks/payments/', '/health'],
};

export class FixedWindowLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = 0;

  constructor(private readonly now: () => number = Date.now) {}

  /** Records a hit; returns how long to wait (ms) when over the limit, else 0. */
  hit(key: string, rule: RateLimitRule): number {
    const t = this.now();
    this.sweep(t);
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      this.hits.set(key, { count: 1, resetAt: t + rule.windowMs });
      return 0;
    }
    entry.count += 1;
    return entry.count > rule.limit ? entry.resetAt - t : 0;
  }

  /** Drop expired windows now and then so memory stays bounded. */
  private sweep(t: number): void {
    if (t - this.lastSweep < 60_000) return;
    this.lastSweep = t;
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
  }

  get size(): number {
    return this.hits.size;
  }
}

export function rateLimitMiddleware(opts: RateLimitOptions = DEFAULT_RATE_LIMITS) {
  const limiter = new FixedWindowLimiter(opts.now);
  return (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path ?? req.url ?? '';
    if (req.method === 'OPTIONS' || opts.exempt.some((p) => path.startsWith(p))) return next();

    const authz = req.headers.authorization;
    const token = typeof authz === 'string' && authz.startsWith('Bearer ') ? authz.slice(7) : '';
    const [key, rule] = token
      ? [
          `s:${createHash('sha256').update(token).digest('base64url').slice(0, 22)}`,
          opts.perSession,
        ]
      : [`i:${req.ip ?? 'unknown'}`, opts.perIp];

    const waitMs = limiter.hit(key, rule);
    if (waitMs > 0) {
      const retry = Math.ceil(waitMs / 1000);
      res.setHeader('Retry-After', String(retry));
      res.status(429).type('application/problem+json').json({
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        detail: 'Demasiados pedidos. Aguarde um momento e tente de novo.',
      });
      return;
    }
    next();
  };
}

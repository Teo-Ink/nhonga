import { describe, expect, it } from 'vitest';
import { FixedWindowLimiter, rateLimitMiddleware } from './rate-limit.js';

function fakeRes() {
  const r = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(k: string, v: string) {
      r.headers[k] = v;
    },
    status(c: number) {
      r.statusCode = c;
      return r;
    },
    type() {
      return r;
    },
    json(b: unknown) {
      r.body = b;
      return r;
    },
  };
  return r;
}

function run(
  mw: ReturnType<typeof rateLimitMiddleware>,
  req: { path: string; method?: string; ip?: string; authorization?: string },
) {
  const res = fakeRes();
  let passed = false;
  mw(
    {
      path: req.path,
      method: req.method ?? 'GET',
      ip: req.ip ?? '1.2.3.4',
      headers: req.authorization ? { authorization: req.authorization } : {},
    } as never,
    res as never,
    () => {
      passed = true;
    },
  );
  return { passed, res };
}

describe('FixedWindowLimiter', () => {
  it('allows up to the limit then asks to wait, and resets after the window', () => {
    let t = 0;
    const l = new FixedWindowLimiter(() => t);
    const rule = { limit: 2, windowMs: 1000 };
    expect(l.hit('a', rule)).toBe(0);
    expect(l.hit('a', rule)).toBe(0);
    expect(l.hit('a', rule)).toBe(1000);
    t = 400;
    expect(l.hit('a', rule)).toBe(600);
    t = 1000;
    expect(l.hit('a', rule)).toBe(0);
  });
});

describe('rateLimitMiddleware', () => {
  const opts = {
    perSession: { limit: 2, windowMs: 60_000 },
    perIp: { limit: 3, windowMs: 60_000 },
    exempt: ['/checkout/webhooks/', '/health'],
    now: () => 0,
  };

  it('limits by session when signed in, independently of the shared IP', () => {
    const mw = rateLimitMiddleware(opts);
    const a = { path: '/wallet', authorization: 'Bearer aaa' };
    const b = { path: '/wallet', authorization: 'Bearer bbb' };
    expect(run(mw, a).passed).toBe(true);
    expect(run(mw, a).passed).toBe(true);
    const third = run(mw, a);
    expect(third.passed).toBe(false);
    expect(third.res.statusCode).toBe(429);
    expect(third.res.headers['Retry-After']).toBe('60');
    // Another session behind the same IP is unaffected.
    expect(run(mw, b).passed).toBe(true);
  });

  it('limits anonymous traffic by IP', () => {
    const mw = rateLimitMiddleware(opts);
    for (let i = 0; i < 3; i++) expect(run(mw, { path: '/catalog/products' }).passed).toBe(true);
    expect(run(mw, { path: '/catalog/products' }).passed).toBe(false);
    expect(run(mw, { path: '/catalog/products', ip: '5.6.7.8' }).passed).toBe(true);
  });

  it('never limits payment webhooks or health checks', () => {
    const mw = rateLimitMiddleware(opts);
    for (let i = 0; i < 10; i++) {
      expect(run(mw, { path: '/checkout/webhooks/paysuite', method: 'POST' }).passed).toBe(true);
      expect(run(mw, { path: '/health/ready' }).passed).toBe(true);
    }
  });
});

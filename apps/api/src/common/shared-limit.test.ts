import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { clientKey, matchRule, sharedLimitMiddleware, type HitCounter } from './shared-limit.js';

function req(method: string, path: string, token?: string, ip = '1.2.3.4'): Request {
  return {
    method,
    path,
    ip,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as unknown as Request;
}
function res() {
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

/** One shared counter = what Postgres gives every instance. */
function sharedCounter(): HitCounter {
  const m = new Map<string, number>();
  return (key) => {
    const n = (m.get(key) ?? 0) + 1;
    m.set(key, n);
    return Promise.resolve(n);
  };
}

async function run(mw: ReturnType<typeof sharedLimitMiddleware>, r: Request) {
  const out = res();
  const next = vi.fn() as unknown as NextFunction;
  mw(r, out as unknown as Response, next);
  await new Promise((s) => setTimeout(s, 0));
  return { out, passed: (next as unknown as ReturnType<typeof vi.fn>).mock.calls.length === 1 };
}

describe('shared limits', () => {
  it('matches only the protected writes', () => {
    expect(matchRule('POST', '/catalog/products')?.name).toBe('publish');
    expect(matchRule('POST', '/catalog/products/abc/reports')?.name).toBe('report');
    expect(matchRule('POST', '/conversations/123/messages')?.name).toBe('message');
    expect(matchRule('GET', '/catalog/products')).toBeNull();
    expect(matchRule('POST', '/checkout/webhooks/pawapay')).toBeNull();
  });

  it('keys by session when there is one, by IP otherwise', () => {
    expect(clientKey(req('POST', '/x', 'tok'), 'client')).toMatch(/^s:/);
    expect(clientKey(req('POST', '/x'), 'client')).toBe('ip:1.2.3.4');
    expect(clientKey(req('POST', '/x', 'tok'), 'ip')).toBe('ip:1.2.3.4');
  });

  it('holds the limit across two API instances sharing one counter', async () => {
    const counter = sharedCounter();
    const a = sharedLimitMiddleware(counter);
    const b = sharedLimitMiddleware(counter);
    let passed = 0;
    for (let i = 0; i < 12; i++) {
      const r = await run(i % 2 ? a : b, req('POST', '/catalog/products/p1/reports', 'tok'));
      if (r.passed) passed++;
      else expect(r.out.statusCode).toBe(429);
    }
    expect(passed).toBe(10);
  });

  it('lets the request through when the counter is down', async () => {
    const mw = sharedLimitMiddleware(() => Promise.reject(new Error('db down')));
    expect((await run(mw, req('POST', '/catalog/products', 't'))).passed).toBe(true);
  });
});

describe('limitScale', () => {
  it('defaults to 1 and never lowers a limit', async () => {
    const { limitScale } = await import('./shared-limit.js');
    expect(limitScale(undefined)).toBe(1);
    expect(limitScale('0.1')).toBe(1);
    expect(limitScale('100')).toBe(100);
  });
});

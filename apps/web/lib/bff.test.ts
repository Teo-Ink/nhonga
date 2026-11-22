import { describe, expect, it, vi } from 'vitest';
import { ApiUnavailableError, apiFetch, timeoutFor, withApi } from './bff';

describe('apiFetch', () => {
  it('prefixes API_URL and forwards init', async () => {
    const f = vi.fn(async () => new Response('ok'));
    await apiFetch('/catalog/x', { method: 'POST' }, f as unknown as typeof fetch);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/v1\/catalog\/x$/);
    expect(init.method).toBe('POST');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('turns a network error into ApiUnavailableError', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(apiFetch('/auth/me', {}, f as unknown as typeof fetch)).rejects.toMatchObject({
      name: 'ApiUnavailableError',
      reason: 'network',
    });
  });

  it('times out a hung API', async () => {
    const hang = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
      );
    await expect(
      apiFetch('/catalog/x', { timeoutMs: 20 }, hang as unknown as typeof fetch),
    ).rejects.toMatchObject({ reason: 'timeout' });
  });

  it('gives AI endpoints a longer timeout', () => {
    expect(timeoutFor('/assistant/chat')).toBeGreaterThan(timeoutFor('/catalog/products'));
  });
});

describe('withApi', () => {
  it('passes a normal response through', async () => {
    const h = withApi(async () => new Response('fine', { status: 201 }));
    expect((await h()).status).toBe(201);
  });

  it('answers 503 problem+json in Portuguese when the API is down', async () => {
    const h = withApi(async () => {
      throw new ApiUnavailableError('/x', 'network');
    });
    const res = await h();
    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect((await res.json()).detail).toMatch(/indisponível/);
  });

  it('uses the route fallback when given (e.g. signed-out state)', async () => {
    const h = withApi(
      async () => {
        throw new ApiUnavailableError('/auth/me', 'timeout');
      },
      () => Response.json({ user: null }),
    );
    const res = await h();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it('answers 502 instead of an unhandled 500 on other errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const h = withApi(async () => {
      throw new SyntaxError('Unexpected token < in JSON');
    });
    expect((await h()).status).toBe(502);
    spy.mockRestore();
  });
});

describe('readJson', () => {
  it('returns null for an empty body (Nest null) instead of throwing', async () => {
    const { readJson } = await import('./bff');
    expect(await readJson(new Response(''))).toBeNull();
    expect(await readJson(new Response('{"a":1}'))).toEqual({ a: 1 });
  });
});

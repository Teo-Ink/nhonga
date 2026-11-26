// The app's API client, tested without a device: requests are captured by a
// fake fetch and the secure store is an in-memory stub (see test/).
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import * as store from 'expo-secure-store';
import {
  clearToken,
  deleteAccount,
  formatMZN,
  getToken,
  getWallet,
  listProducts,
  me,
  recordEvent,
  removeFavorite,
  requestOtp,
  revealContact,
  sendCrashReport,
  setToken,
  topupWallet,
  verifyOtp,
} from './api.ts';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}
let calls: Call[] = [];
let respond: (call: Call) => { status?: number; json?: unknown } = () => ({ json: {} });

globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
  const call: Call = {
    url: String(input),
    method: init.method ?? 'GET',
    headers: Object.fromEntries(
      Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [
        k.toLowerCase(),
        v,
      ]),
    ),
    body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
  };
  calls.push(call);
  const r = respond(call);
  return new Response(JSON.stringify(r.json ?? {}), {
    status: r.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}) as typeof fetch;

const stub = store as unknown as { reset(): void; state: { failing: boolean } };

beforeEach(async () => {
  calls = [];
  respond = () => ({ json: {} });
  stub.reset();
  await clearToken();
});

describe('catalogue requests', () => {
  it('calls the versioned API and sends only the filters that were set', async () => {
    await listProducts({
      q: '  toyota ',
      category: 'viaturas',
      sort: 'price_asc',
      minPriceCents: 0,
    });
    const url = new URL(calls[0]!.url);
    assert.equal(url.pathname, '/v1/catalog/products');
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      limit: '48',
      q: 'toyota',
      category: 'viaturas',
      sort: 'price_asc',
      minPrice: '0',
    });
    assert.equal(calls[0]!.headers['accept-language'], 'pt');
  });

  it('leaves the default sort and empty search out of the URL', async () => {
    await listProducts({ q: '   ', sort: 'relevance', limit: 12 });
    assert.equal(new URL(calls[0]!.url).search, '?limit=12');
  });

  it('browses without a session token even when signed in', async () => {
    await setToken('tok-1');
    await listProducts();
    assert.equal(calls[0]!.headers['authorization'], undefined);
  });
});

describe('session', () => {
  it('keeps the token in the secure store and sends it on private calls', async () => {
    await setToken('tok-1');
    assert.equal(await getToken(), 'tok-1');
    await getWallet();
    assert.equal(calls[0]!.url.endsWith('/v1/wallet'), true);
    assert.equal(calls[0]!.headers['authorization'], 'Bearer tok-1');
  });

  it('sends no authorization header when signed out', async () => {
    await me();
    assert.equal(calls[0]!.headers['authorization'], undefined);
  });

  it('forgets the token on sign-out', async () => {
    await setToken('tok-1');
    await clearToken();
    assert.equal(await getToken(), null);
  });

  it('still works where secure storage is unavailable (memory fallback)', async () => {
    stub.state.failing = true;
    await setToken('tok-web');
    assert.equal(await getToken(), 'tok-web');
    await clearToken();
    assert.equal(await getToken(), null);
  });

  it('signs in with the code and never sends a phone to verify', async () => {
    respond = (c) =>
      c.url.endsWith('/request')
        ? { json: { challengeId: 'ch-1' } }
        : { json: { sessionToken: 's', user: { id: 'u' } } };
    const { challengeId } = await requestOtp('+258841234567');
    await verifyOtp(challengeId, '123456');
    assert.deepEqual(calls[0]!.body, { phone: '+258841234567' });
    assert.deepEqual(calls[1]!.body, { challengeId: 'ch-1', code: '123456' });
  });

  it('deletes the account with the session and reports a failure in Portuguese', async () => {
    await setToken('tok-1');
    await deleteAccount();
    assert.equal(calls[0]!.method, 'DELETE');
    assert.equal(calls[0]!.headers['authorization'], 'Bearer tok-1');
    respond = () => ({ status: 500 });
    await assert.rejects(deleteAccount(), /Não foi possível eliminar a conta/);
  });
});

describe('money', () => {
  it('sends the idempotency key with a top-up, so a retry cannot charge twice', async () => {
    await setToken('tok-1');
    await topupWallet(50_000, 'key-abc');
    assert.equal(calls[0]!.method, 'POST');
    assert.equal(calls[0]!.headers['idempotency-key'], 'key-abc');
    assert.equal(calls[0]!.headers['authorization'], 'Bearer tok-1');
    assert.deepEqual(calls[0]!.body, { amountCents: 50_000 });
  });

  it("shows the API's own message when a payment is refused", async () => {
    respond = () => ({ status: 400, json: { detail: 'Saldo insuficiente.' } });
    await assert.rejects(topupWallet(100, 'k'), /Saldo insuficiente\./);
  });

  it('falls back to a generic error when the API gives no message', async () => {
    respond = () => ({ status: 503 });
    await assert.rejects(topupWallet(100, 'k'), /POST \/wallet\/topup → 503/);
  });

  it('formats meticais the Mozambican way', () => {
    assert.equal(formatMZN(0), '0,00 MT');
    assert.equal(formatMZN(15_000), '150,00 MT');
    assert.equal(formatMZN(123_456_789), '1.234.567,89 MT');
    assert.equal(formatMZN(-250), '-2,50 MT');
    assert.equal(formatMZN(99.6), '1,00 MT');
  });
});

describe('seller contact (PRIV-01)', () => {
  it('asks for the number by listing and returns it', async () => {
    respond = () => ({ json: { whatsapp: '258841234567', phone: null } });
    const n = await revealContact({ productSlug: 'toyota-runx' });
    assert.deepEqual(n, { whatsapp: '258841234567', phone: null });
    assert.equal(calls[0]!.url.endsWith('/v1/catalog/contacts'), true);
    assert.deepEqual(calls[0]!.body, { productSlug: 'toyota-runx' });
  });

  it('returns null, not an exception, when the limit is reached', async () => {
    respond = () => ({ status: 429, json: { detail: 'Demasiados pedidos.' } });
    assert.equal(await revealContact({ vendorSlug: 'mama-rosa' }), null);
  });
});

describe('best-effort calls', () => {
  it('never throws from an engagement event, even offline', async () => {
    const real = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch;
    assert.doesNotThrow(() => recordEvent('toyota-runx', 'share'));
    await new Promise((r) => setTimeout(r, 5));
    globalThis.fetch = real;
  });

  it('posts crash reports to the API and swallows failures', async () => {
    sendCrashReport({ source: 'mobile', message: 'TypeError: x', platform: 'android 14' });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(calls[0]!.url.endsWith('/v1/client-errors'), true);
    assert.deepEqual(calls[0]!.body, {
      source: 'mobile',
      message: 'TypeError: x',
      platform: 'android 14',
    });
    assert.equal(calls[0]!.headers['authorization'], undefined);
    const real = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch;
    assert.doesNotThrow(() => sendCrashReport({ source: 'mobile', message: 'x' }));
    await new Promise((r) => setTimeout(r, 5));
    globalThis.fetch = real;
  });

  it('encodes ids in the URL', async () => {
    await setToken('tok-1');
    await removeFavorite('a/b c');
    assert.equal(calls[0]!.url.endsWith('/v1/favorites/a%2Fb%20c'), true);
    assert.equal(calls[0]!.method, 'DELETE');
  });
});

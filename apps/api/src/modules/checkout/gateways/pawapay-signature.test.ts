// PawaPay signed callbacks (PAY-07): a real P-256 key pair stands in for
// PawaPay's, so every check runs against genuine signatures.
import { createHash, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { FetchLike } from '../checkout.types';
import { PawaPayGateway, callbackUrlVariants } from './pawapay.gateway';
import { PawaPayKeys, parseSignatureInput, verifyCallback } from './pawapay-signature';

const URL_ = 'https://api.nhonga.co.mz/v1/checkout/webhooks/pawapay';
const KEY_ID = 'HTTP_EC_P256_KEY:1';
const NOW = 1_800_000_000_000;
const pawapay = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const stranger = generateKeyPairSync('ec', { namedCurve: 'P-256' });

interface Opts {
  body?: string;
  url?: string;
  key?: KeyObject;
  alg?: string;
  created?: number;
  components?: string[];
}

/** Builds a callback exactly as the PawaPay docs describe it. */
function signed(o: Opts = {}) {
  const body = o.body ?? JSON.stringify({ depositId: 'dep-1', status: 'COMPLETED' });
  const url = new URL(o.url ?? URL_);
  const created = o.created ?? NOW / 1000;
  const components = o.components ?? [
    '@method',
    '@authority',
    '@path',
    'signature-date',
    'content-digest',
    'content-type',
  ];
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'signature-date': '2027-01-15T08:00:00.000000000Z',
    'content-digest': `sha-512=:${createHash('sha512').update(body).digest('base64')}:`,
  };
  const params = `(${components.map((c) => `"${c}"`).join(' ')});alg="${o.alg ?? 'ecdsa-p256-sha256'}";keyid="${KEY_ID}";created=${created};expires=${created + 60}`;
  const derived: Record<string, string> = {
    '@method': 'POST',
    '@authority': url.host,
    '@path': url.pathname,
  };
  const base = [
    ...components.map((c) => `"${c}": ${derived[c] ?? headers[c]}`),
    `"@signature-params": ${params}`,
  ].join('\n');
  headers['signature-input'] = `sig-pp=${params}`;
  headers['signature'] =
    `sig-pp=:${sign('sha256', Buffer.from(base), o.key ?? pawapay.privateKey).toString('base64')}:`;
  return { headers, rawBody: body };
}

const key = async (id: string) => (id === KEY_ID ? pawapay.publicKey : null);
const check = (cb: { headers: Record<string, string>; rawBody: string }, nowMs = NOW) =>
  verifyCallback({ ...cb, callbackUrl: URL_, key, nowMs });

describe('verifyCallback', () => {
  it('accepts a callback signed by PawaPay', async () => {
    expect(await check(signed())).toEqual({ ok: true });
  });

  it('rejects a body changed after signing', async () => {
    const cb = signed();
    cb.rawBody = cb.rawBody.replace('dep-1', 'dep-2');
    expect(await check(cb)).toEqual({ ok: false, reason: 'digest_mismatch' });
  });

  it('rejects a body changed together with its digest (signature no longer matches)', async () => {
    const cb = signed();
    cb.rawBody = cb.rawBody.replace('dep-1', 'dep-2');
    cb.headers['content-digest'] =
      `sha-512=:${createHash('sha512').update(cb.rawBody).digest('base64')}:`;
    expect(await check(cb)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it("rejects a signature made with someone else's key", async () => {
    expect(await check(signed({ key: stranger.privateKey }))).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('rejects a callback signed for another address (replay from another merchant)', async () => {
    const cb = signed({ url: 'https://outra-loja.example/v1/checkout/webhooks/pawapay' });
    expect(await check(cb)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a callback replayed after it expired', async () => {
    expect(await check(signed(), NOW + 5 * 60_000)).toEqual({ ok: false, reason: 'expired' });
    // Inside the 60 s window plus clock tolerance it is still good.
    expect(await check(signed(), NOW + 80_000)).toEqual({ ok: true });
  });

  it('rejects another algorithm, an unknown key and a signature that skips the body', async () => {
    expect(await check(signed({ alg: 'rsa-v1_5-sha256' }))).toMatchObject({
      reason: 'unsupported_alg',
    });
    expect(
      await verifyCallback({ ...signed(), callbackUrl: URL_, key: async () => null, nowMs: NOW }),
    ).toMatchObject({ reason: 'unknown_key' });
    expect(await check(signed({ components: ['@method', '@authority', '@path'] }))).toMatchObject({
      reason: 'missing_components',
    });
  });

  it('tells an unsigned callback apart from a broken one', async () => {
    expect(await check({ headers: {}, rawBody: '{}' })).toEqual({ ok: false, reason: 'unsigned' });
    const cb = signed();
    delete cb.headers['content-digest'];
    expect(await check(cb)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('reads the Signature-Input from the PawaPay docs', () => {
    const p = parseSignatureInput(
      'sig-pp=("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="HTTP_EC_P256_KEY:1";created=1714668351;expires=1714668411',
    );
    expect(p).toMatchObject({
      label: 'sig-pp',
      alg: 'ecdsa-p256-sha256',
      keyid: 'HTTP_EC_P256_KEY:1',
      expires: 1714668411,
    });
    expect(p!.components).toHaveLength(6);
    expect(parseSignatureInput('nonsense')).toBeNull();
  });
});

describe('PawaPayKeys', () => {
  const pem = pawapay.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const server =
    (calls: string[], list: unknown = [{ id: KEY_ID, key: pem }]): FetchLike =>
    async (url) => {
      calls.push(url);
      return { status: 200, text: async () => JSON.stringify(list) };
    };

  it('fetches the keys once and reuses them', async () => {
    const calls: string[] = [];
    const keys = new PawaPayKeys('https://api.sandbox.pawapay.io', server(calls), () => NOW);
    expect(await keys.get(KEY_ID)).not.toBeNull();
    expect(await keys.get(KEY_ID)).not.toBeNull();
    expect(calls).toEqual(['https://api.sandbox.pawapay.io/v2/public-key/http']);
  });

  it('does not hammer PawaPay when callbacks name an unknown key', async () => {
    const calls: string[] = [];
    let now = NOW;
    const keys = new PawaPayKeys('https://x', server(calls), () => now);
    expect(await keys.get('OTHER:9')).toBeNull();
    expect(await keys.get('OTHER:9')).toBeNull();
    expect(calls).toHaveLength(1);
    now += 6 * 60_000;
    await keys.get('OTHER:9');
    expect(calls).toHaveLength(2);
  });

  it('keeps working keys when a refresh fails', async () => {
    let now = NOW;
    let up = true;
    const keys = new PawaPayKeys(
      'https://x',
      async () => {
        if (!up) throw new Error('down');
        return { status: 200, text: async () => JSON.stringify([{ id: KEY_ID, key: pem }]) };
      },
      () => now,
    );
    await keys.get(KEY_ID);
    up = false;
    now += 25 * 60 * 60_000;
    expect(await keys.get(KEY_ID)).not.toBeNull();
  });
});

describe('PawaPay gateway webhook', () => {
  const pem = pawapay.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const fetchKeys: FetchLike = async () => ({
    status: 200,
    text: async () => JSON.stringify([{ id: KEY_ID, key: pem }]),
  });
  const gw = (requireSignedCallbacks: boolean, callbackUrl = URL_) =>
    new PawaPayGateway(
      {
        apiToken: 't',
        baseUrl: 'https://api.sandbox.pawapay.io',
        callbackUrl,
        requireSignedCallbacks,
      },
      fetchKeys,
      () => NOW,
    );

  it('accepts a signed callback and returns its deposit id', async () => {
    expect(await gw(true).parseWebhook(signed())).toEqual({ valid: true, gatewayRef: 'dep-1' });
  });

  it('accepts it whether the dashboard has the address with or without /v1', async () => {
    const registered = 'https://api.nhonga.co.mz/checkout/webhooks/pawapay';
    expect(await gw(true).parseWebhook(signed({ url: registered }))).toMatchObject({ valid: true });
    expect(callbackUrlVariants(URL_)).toEqual([URL_, registered]);
  });

  it('always rejects a forged signature, even when signatures are optional', async () => {
    const forged = signed({ key: stranger.privateKey });
    for (const required of [true, false])
      expect(await gw(required).parseWebhook(forged)).toEqual({
        valid: false,
        reason: 'bad_signature',
        detail: 'bad_signature',
      });
  });

  it('takes unsigned callbacks only while signatures are not required', async () => {
    const unsigned = { headers: {}, rawBody: JSON.stringify({ depositId: 'dep-1' }) };
    expect(await gw(false).parseWebhook(unsigned)).toEqual({ valid: true, gatewayRef: 'dep-1' });
    expect(await gw(true).parseWebhook(unsigned)).toEqual({
      valid: false,
      reason: 'bad_signature',
      detail: 'unsigned',
    });
  });
});

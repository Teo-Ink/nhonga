import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildCheckoutSetup } from './checkout.config.js';
import {
  GatewayUnavailableError,
  centsToDecimal,
  decimalToCents,
  type FetchLike,
} from './checkout.types.js';
import { PawaPayGateway } from './gateways/pawapay.gateway.js';
import { PaySuiteGateway, paysuiteReference } from './gateways/paysuite.gateway.js';

type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown };

function fakeFetch(status: number, body: unknown, calls: Call[] = []): FetchLike {
  return async (url, init) => {
    calls.push({
      url,
      method: init.method,
      headers: init.headers,
      body: init.body ? JSON.parse(init.body) : undefined,
    });
    return { status, text: async () => JSON.stringify(body) };
  };
}
const ID = '7f2c1c4e-8a7b-4d7e-9b51-2f6f6f0c1a11';
const input = {
  intentId: ID,
  amountCents: 50_000,
  method: 'mpesa' as const,
  description: 'Carregamento Nhonga',
  returnUrl: 'https://nhonga.co.mz/pagamento/x',
  webhookUrl: 'https://api.nhonga.co.mz/checkout/webhooks/pawapay',
};

describe('amount helpers', () => {
  it('converts cents and decimals', () => {
    expect(centsToDecimal(50_000)).toBe('500.00');
    expect(centsToDecimal(12_345)).toBe('123.45');
    expect(decimalToCents('123.45')).toBe(12_345);
    expect(decimalToCents(500)).toBe(50_000);
    expect(decimalToCents('abc')).toBeNull();
  });
});

describe('PawaPay', () => {
  const cfg = { apiToken: 'tok', baseUrl: 'https://api.sandbox.pawapay.io' };

  it('creates a payment page using the intent id as depositId', async () => {
    const calls: Call[] = [];
    const gw = new PawaPayGateway(
      cfg,
      fakeFetch(200, { redirectUrl: 'https://pay.pawapay.io/abc' }, calls),
    );
    const r = await gw.create(input);
    expect(r).toEqual({ gatewayRef: ID, checkoutUrl: 'https://pay.pawapay.io/abc' });
    expect(calls[0]?.url).toBe('https://api.sandbox.pawapay.io/v2/paymentpage');
    expect(calls[0]?.headers['authorization']).toBe('Bearer tok');
    expect(calls[0]?.body).toMatchObject({ depositId: ID, amount: '500.00', country: 'MOZ' });
  });

  it('maps deposit statuses', async () => {
    const st = async (body: unknown, created?: Date, now = Date.now()) =>
      new PawaPayGateway(cfg, fakeFetch(200, body), () => now).status(ID, created);
    expect(
      (await st({ status: 'FOUND', data: { status: 'COMPLETED', amount: '500.00' } })).status,
    ).toBe('paid');
    expect(
      (await st({ status: 'FOUND', data: { status: 'COMPLETED', amount: '500.00' } })).amountCents,
    ).toBe(50_000);
    expect((await st({ status: 'FOUND', data: { status: 'PROCESSING' } })).status).toBe('pending');
    const f = await st({
      status: 'FOUND',
      data: { status: 'FAILED', failureReason: { failureCode: 'INSUFFICIENT_BALANCE' } },
    });
    expect(f).toMatchObject({ status: 'failed', failureReason: 'INSUFFICIENT_BALANCE' });
    const t0 = new Date('2026-01-01T10:00:00Z');
    expect((await st({ status: 'NOT_FOUND' }, t0, t0.getTime() + 5 * 60_000)).status).toBe(
      'pending',
    );
    expect((await st({ status: 'NOT_FOUND' }, t0, t0.getTime() + 16 * 60_000)).status).toBe(
      'failed',
    );
  });

  it('treats 5xx as unavailable (failover) and 4xx as a rejection', async () => {
    await expect(new PawaPayGateway(cfg, fakeFetch(503, {})).create(input)).rejects.toBeInstanceOf(
      GatewayUnavailableError,
    );
    const err = await new PawaPayGateway(
      cfg,
      fakeFetch(400, { failureReason: { failureCode: 'INVALID_AMOUNT' } }),
    )
      .create(input)
      .catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(GatewayUnavailableError);
    expect(String(err)).toContain('INVALID_AMOUNT');
  });

  it('treats network errors as unavailable', async () => {
    const gw = new PawaPayGateway(cfg, async () => {
      throw new Error('ECONNRESET');
    });
    await expect(gw.create(input)).rejects.toBeInstanceOf(GatewayUnavailableError);
  });

  it('extracts depositId from callbacks', () => {
    const gw = new PawaPayGateway(cfg, fakeFetch(200, {}));
    expect(
      gw.parseWebhook({
        headers: {},
        rawBody: JSON.stringify({ depositId: ID, status: 'COMPLETED' }),
      }),
    ).toEqual({
      valid: true,
      gatewayRef: ID,
    });
    expect(gw.parseWebhook({ headers: {}, rawBody: 'not json' }).valid).toBe(false);
  });
});

describe('PaySuite', () => {
  const cfg = { apiToken: 'tok', webhookSecret: 'whsec', baseUrl: 'https://paysuite.tech' };
  const sign = (body: string, secret = 'whsec') =>
    createHmac('sha256', secret).update(body).digest('hex');

  it('builds an alphanumeric reference ≤ 50 chars', () => {
    const r = paysuiteReference(ID);
    expect(r).toMatch(/^[A-Za-z0-9]{1,50}$/);
    expect(r.startsWith('NHG')).toBe(true);
  });

  it('creates a payment and maps the method', async () => {
    const calls: Call[] = [];
    const gw = new PaySuiteGateway(
      cfg,
      fakeFetch(
        201,
        { status: 'success', data: { id: 'ps_1', checkout_url: 'https://paysuite.tech/c/ps_1' } },
        calls,
      ),
    );
    expect(await gw.create({ ...input, method: 'card' })).toEqual({
      gatewayRef: 'ps_1',
      checkoutUrl: 'https://paysuite.tech/c/ps_1',
    });
    expect(calls[0]?.body).toMatchObject({ amount: '500.00', method: 'credit_card' });
    await gw.create({ ...input, method: 'emola' });
    expect(calls[1]?.body).toMatchObject({ method: 'emola' });
  });

  it('verifies webhook signatures', () => {
    const gw = new PaySuiteGateway(cfg, fakeFetch(200, {}));
    const body = JSON.stringify({ event: 'payment.success', data: { id: 'ps_1', amount: 500 } });
    expect(gw.parseWebhook({ headers: { 'x-signature': sign(body) }, rawBody: body })).toEqual({
      valid: true,
      gatewayRef: 'ps_1',
    });
    expect(
      gw.parseWebhook({ headers: { 'x-signature': sign(body, 'other') }, rawBody: body }),
    ).toEqual({
      valid: false,
      reason: 'bad_signature',
    });
    expect(gw.parseWebhook({ headers: {}, rawBody: body }).valid).toBe(false);
    // Tampered body with the original signature.
    expect(
      gw.parseWebhook({
        headers: { 'x-signature': sign(body) },
        rawBody: body.replace('500', '5000'),
      }).valid,
    ).toBe(false);
  });

  it('maps payment statuses', async () => {
    const st = (b: unknown) => new PaySuiteGateway(cfg, fakeFetch(200, b)).status('ps_1');
    expect((await st({ data: { status: 'completed', amount: '500.00' } })).status).toBe('paid');
    expect((await st({ data: { status: 'pending' } })).status).toBe('pending');
    expect((await st({ data: { status: 'failed' } })).status).toBe('failed');
  });
});

describe('setup', () => {
  const f = fakeFetch(200, {});
  it('defaults to mock outside production', () => {
    expect(buildCheckoutSetup({}, f).mode).toBe('mock');
  });
  it('fails loudly in live mode without credentials', () => {
    expect(() => buildCheckoutSetup({ CHECKOUT_MODE: 'live' }, f)).toThrow(/PAWAPAY_API_TOKEN/);
  });
  it('chains PawaPay then PaySuite in live mode', () => {
    const s = buildCheckoutSetup(
      {
        CHECKOUT_MODE: 'live',
        PAWAPAY_API_TOKEN: 'a',
        PAYSUITE_API_TOKEN: 'b',
        PAYSUITE_WEBHOOK_SECRET: 'c',
        PUBLIC_API_URL: 'https://api.nhonga.co.mz',
      },
      f,
    );
    expect(s.chain.map((g) => g.id)).toEqual(['pawapay', 'paysuite']);
  });
});

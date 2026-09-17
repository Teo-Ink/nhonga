import { beforeEach, describe, expect, it } from 'vitest';
import { cents } from '@nhonga/shared';
import {
  MockWalletProvider,
  signPayload,
  type CallbackDelivery,
  type Scheduler,
} from './mock-wallet.provider.js';
import type { PaymentRequest, RawCallback } from '../payment-provider.interface.js';

const SECRET = 'test-secret';

interface Delivered {
  headers: Record<string, string>;
  rawBody: string;
}

/**
 * A scheduler that collects tasks instead of running them, so a 240-second late callback can be
 * asserted in a millisecond. Waiting on real timers is how a test suite becomes something people
 * skip.
 */
function makeTestHarness() {
  const tasks: Array<{ delayMs: number; run: () => void }> = [];
  const delivered: Delivered[] = [];

  const schedule: Scheduler = (delayMs, task) => {
    tasks.push({ delayMs, run: task });
  };
  const deliver: CallbackDelivery = (payload) => {
    delivered.push({ headers: payload.headers, rawBody: payload.rawBody });
  };

  const provider = new MockWalletProvider(
    {
      providerId: 'mpesa',
      callbackSecret: SECRET,
      minDelayMs: 5_000,
      maxDelayMs: 20_000,
      approvalTimeoutSeconds: 180,
      seed: 42,
    },
    deliver,
    schedule,
  );

  return {
    provider,
    tasks,
    delivered,
    runAll: () => {
      for (const task of tasks.splice(0)) task.run();
    },
  };
}

function requestFor(msisdn: string, amountCents = 320000): PaymentRequest {
  return {
    paymentId: 'pay_1',
    idempotencyKey: 'idem_1',
    amountCents: cents(amountCents),
    currency: 'MZN',
    payerMsisdn: msisdn,
    reference: 'NHONGA-4821',
    description: 'Pedido #4821',
  };
}

function asRawCallback(delivered: Delivered): RawCallback {
  return { headers: delivered.headers, rawBody: delivered.rawBody };
}

let harness: ReturnType<typeof makeTestHarness>;

beforeEach(() => {
  harness = makeTestHarness();
});

describe('requestPayment()', () => {
  it('accepts and returns a provider transaction id and expiry', async () => {
    const result = await harness.provider.requestPayment(requestFor('+258840000001'));

    expect(result.outcome).toBe('accepted');
    if (result.outcome !== 'accepted') return;
    expect(result.providerTxId).toMatch(/^MOCK-MPESA-/);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('does not resolve synchronously — the callback is scheduled, not immediate', async () => {
    await harness.provider.requestPayment(requestFor('+258840000001'));
    expect(harness.delivered).toHaveLength(0);
    expect(harness.tasks).toHaveLength(1);
    expect(harness.tasks[0]?.delayMs).toBe(8_000);
  });

  it('rejects outright when the provider itself is unavailable', async () => {
    const result = await harness.provider.requestPayment(requestFor('+258840000010'));
    expect(result.outcome).toBe('rejected');
    if (result.outcome !== 'rejected') return;
    expect(result.code).toBe('provider_unavailable');
    expect(result.retryable).toBe(true);
  });

  it('rejects an unusable number without scheduling anything', async () => {
    const result = await harness.provider.requestPayment(requestFor('+258840000011'));
    expect(result.outcome).toBe('rejected');
    if (result.outcome !== 'rejected') return;
    expect(result.code).toBe('invalid_msisdn');
    expect(result.retryable).toBe(false);
    expect(harness.tasks).toHaveLength(0);
  });

  it('schedules nothing for the silent number, so only reconciliation can close it', async () => {
    const result = await harness.provider.requestPayment(requestFor('+258840000012'));
    expect(result.outcome).toBe('accepted');
    expect(harness.tasks).toHaveLength(0);
  });

  it('is deterministic for an unlisted number when seeded', async () => {
    const a = makeTestHarness();
    const b = makeTestHarness();
    await a.provider.requestPayment(requestFor('+258849999999'));
    await b.provider.requestPayment(requestFor('+258849999999'));
    expect(a.tasks[0]?.delayMs).toBe(b.tasks[0]?.delayMs);
  });
});

describe('callback delivery', () => {
  it('delivers a signed, parseable success callback', async () => {
    await harness.provider.requestPayment(requestFor('+258840000001'));
    harness.runAll();

    expect(harness.delivered).toHaveLength(1);
    const delivery = harness.delivered[0];
    expect(delivery).toBeDefined();
    if (delivery === undefined) return;

    const parsed = harness.provider.parseCallback(asRawCallback(delivery));
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.status).toBe('paid');
    expect(parsed.amountCents).toBe(320000);
    expect(parsed.ourReference).toBe('NHONGA-4821');
  });

  it('reports insufficient balance as a failure with a usable code', async () => {
    await harness.provider.requestPayment(requestFor('+258840000003'));
    harness.runAll();

    const delivery = harness.delivered[0];
    if (delivery === undefined) throw new Error('expected a callback');
    const parsed = harness.provider.parseCallback(asRawCallback(delivery));

    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.status).toBe('failed');
    expect(parsed.code).toBe('insufficient_balance');
  });

  it('reports a buyer cancellation as cancelled, not failed', async () => {
    await harness.provider.requestPayment(requestFor('+258840000005'));
    harness.runAll();

    const delivery = harness.delivered[0];
    if (delivery === undefined) throw new Error('expected a callback');
    const parsed = harness.provider.parseCallback(asRawCallback(delivery));

    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.status).toBe('cancelled');
    expect(parsed.code).toBe('user_cancelled');
  });

  it('delivers the same event three times for the duplicate-callback case', async () => {
    await harness.provider.requestPayment(requestFor('+258840000007'));
    harness.runAll();

    expect(harness.delivered).toHaveLength(3);

    // All three carry the same event id, so the UNIQUE (provider, provider_event_id)
    // constraint collapses them into one state change.
    const ids = harness.delivered.map((delivery) => {
      const parsed = harness.provider.parseCallback(asRawCallback(delivery));
      return parsed.valid ? parsed.providerEventId : null;
    });
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).not.toBeNull();
  });

  it('schedules the late confirmation beyond the approval window', async () => {
    const accepted = await harness.provider.requestPayment(requestFor('+258840000006'));
    expect(accepted.outcome).toBe('accepted');
    if (accepted.outcome !== 'accepted') return;

    const scheduledAt = harness.tasks[0]?.delayMs ?? 0;
    const windowMs = 180 * 1000;

    // This is the EXPIRED → PAID case: the money leaves the buyer's wallet after our screen
    // has already given up on them.
    expect(scheduledAt).toBeGreaterThan(windowMs);
  });
});

describe('parseCallback() — the defences', () => {
  it('refuses a payload signed with the wrong key', async () => {
    await harness.provider.requestPayment(requestFor('+258840000009'));
    harness.runAll();

    const delivery = harness.delivered[0];
    if (delivery === undefined) throw new Error('expected a callback');

    const parsed = harness.provider.parseCallback(asRawCallback(delivery));
    expect(parsed.valid).toBe(false);
    if (parsed.valid) return;
    expect(parsed.reason).toBe('bad_signature');
  });

  it('refuses a payload with no signature at all', () => {
    const body = JSON.stringify({ eventId: 'e', providerTxId: 't' });
    const parsed = harness.provider.parseCallback({ headers: {}, rawBody: body });
    expect(parsed.valid).toBe(false);
    if (parsed.valid) return;
    expect(parsed.reason).toBe('bad_signature');
  });

  it('refuses a correctly signed payload whose body was then altered', () => {
    const original = JSON.stringify({
      eventId: 'e1',
      providerTxId: 't1',
      reference: 'NHONGA-4821',
      status: 'paid',
      code: null,
      amountCents: 100,
      occurredAt: new Date().toISOString(),
    });
    const signature = signPayload(original, SECRET);
    const tampered = original.replace('"amountCents":100', '"amountCents":1');

    const parsed = harness.provider.parseCallback({
      headers: { 'x-nhonga-signature': signature },
      rawBody: tampered,
    });
    expect(parsed.valid).toBe(false);
    if (parsed.valid) return;
    expect(parsed.reason).toBe('bad_signature');
  });

  it('surfaces an amount that disagrees with our record, for the caller to reject', async () => {
    // The provider signs it correctly, so signature verification passes — the mismatch has to
    // be caught by comparing against our own payment row. This test proves the parser reports
    // the provider's figure faithfully rather than echoing ours.
    await harness.provider.requestPayment(requestFor('+258840000008'));
    harness.runAll();

    const delivery = harness.delivered[0];
    if (delivery === undefined) throw new Error('expected a callback');
    const parsed = harness.provider.parseCallback(asRawCallback(delivery));

    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.amountCents).toBe(1);
    expect(parsed.amountCents).not.toBe(320000);
  });

  it('refuses malformed JSON', () => {
    const body = 'not json at all';
    const parsed = harness.provider.parseCallback({
      headers: { 'x-nhonga-signature': signPayload(body, SECRET) },
      rawBody: body,
    });
    expect(parsed.valid).toBe(false);
    if (parsed.valid) return;
    expect(parsed.reason).toBe('malformed');
  });

  it('refuses a well-signed payload missing required fields', () => {
    const body = JSON.stringify({ eventId: 'e1' });
    const parsed = harness.provider.parseCallback({
      headers: { 'x-nhonga-signature': signPayload(body, SECRET) },
      rawBody: body,
    });
    expect(parsed.valid).toBe(false);
    if (parsed.valid) return;
    expect(parsed.reason).toBe('malformed');
  });

  it('refuses an unrecognised status value', () => {
    const body = JSON.stringify({
      eventId: 'e1',
      providerTxId: 't1',
      reference: 'r',
      status: 'reticulating',
      amountCents: 100,
      occurredAt: new Date().toISOString(),
    });
    const parsed = harness.provider.parseCallback({
      headers: { 'x-nhonga-signature': signPayload(body, SECRET) },
      rawBody: body,
    });
    expect(parsed.valid).toBe(false);
  });

  it('never throws on hostile input', () => {
    const inputs = ['', '{}', '[]', 'null', '{"eventId":123}', '\u0000'];
    for (const rawBody of inputs) {
      expect(() =>
        harness.provider.parseCallback({
          headers: { 'x-nhonga-signature': signPayload(rawBody, SECRET) },
          rawBody,
        }),
      ).not.toThrow();
    }
  });
});

describe('queryStatus()', () => {
  it('reports pending before the callback fires', async () => {
    const accepted = await harness.provider.requestPayment(requestFor('+258840000001'));
    if (accepted.outcome !== 'accepted') throw new Error('expected acceptance');

    const status = await harness.provider.queryStatus(accepted.providerTxId);
    expect(status.status).toBe('pending');
  });

  it('reports the resolved outcome afterwards — the reconciliation path', async () => {
    const accepted = await harness.provider.requestPayment(requestFor('+258840000001'));
    if (accepted.outcome !== 'accepted') throw new Error('expected acceptance');
    harness.runAll();

    const status = await harness.provider.queryStatus(accepted.providerTxId);
    expect(status.status).toBe('paid');
    expect(status.amountCents).toBe(320000);
  });

  it('reports unknown for a transaction it has never seen, without throwing', async () => {
    const status = await harness.provider.queryStatus('MOCK-MPESA-NOPE');
    expect(status.status).toBe('unknown');
    expect(status.providerTxId).toBeNull();
  });

  it('resolves a silent payment only through this path', async () => {
    const accepted = await harness.provider.requestPayment(requestFor('+258840000012'));
    if (accepted.outcome !== 'accepted') throw new Error('expected acceptance');
    harness.runAll();

    expect(harness.delivered).toHaveLength(0);
    const status = await harness.provider.queryStatus(accepted.providerTxId);
    expect(status.status).toBe('pending');
  });
});

describe('refund()', () => {
  it('accepts a refund of a settled payment', async () => {
    const accepted = await harness.provider.requestPayment(requestFor('+258840000001'));
    if (accepted.outcome !== 'accepted') throw new Error('expected acceptance');
    harness.runAll();

    const result = await harness.provider.refund({
      paymentId: 'pay_1',
      providerTxId: accepted.providerTxId,
      idempotencyKey: 'idem_refund_1',
      amountCents: cents(320000),
      reason: 'Disputa resolvida a favor do comprador',
    });
    expect(result.outcome).toBe('accepted');
  });

  it('refuses to refund more than was paid', async () => {
    const accepted = await harness.provider.requestPayment(requestFor('+258840000001'));
    if (accepted.outcome !== 'accepted') throw new Error('expected acceptance');
    harness.runAll();

    const result = await harness.provider.refund({
      paymentId: 'pay_1',
      providerTxId: accepted.providerTxId,
      idempotencyKey: 'idem_refund_2',
      amountCents: cents(999999),
      reason: 'erro',
    });
    expect(result.outcome).toBe('rejected');
    if (result.outcome !== 'rejected') return;
    expect(result.code).toBe('limit_exceeded');
  });

  it('refuses to refund a payment that never settled', async () => {
    const accepted = await harness.provider.requestPayment(requestFor('+258840000001'));
    if (accepted.outcome !== 'accepted') throw new Error('expected acceptance');

    const result = await harness.provider.refund({
      paymentId: 'pay_1',
      providerTxId: accepted.providerTxId,
      idempotencyKey: 'idem_refund_3',
      amountCents: cents(100),
      reason: 'erro',
    });
    expect(result.outcome).toBe('rejected');
  });
});

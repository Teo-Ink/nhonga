/**
 * Mock wallet provider.
 *
 * Stands in for M-Pesa and e-Mola until the merchant agreements land (OQ-7, OQ-8). It is not a
 * stub that returns success — a mock that resolves instantly and always succeeds is how a race
 * condition ships. It reproduces the parts of the real protocol that actually break things:
 *
 *   • the callback arrives asynchronously, after a randomised 5–90 second delay
 *   • it is HMAC-signed, so signature verification is genuinely exercised in development
 *   • outcomes are driven by the payer's MSISDN, so every failure path is reachable by hand
 *     and deterministic in CI
 *
 * See docs/phase-2-architecture/04-payments-architecture.md §6.
 */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { cents, type Cents } from '@nhonga/shared';
import type {
  CallbackParseResult,
  DisbursementRequest,
  DisbursementResult,
  FailureCode,
  PaymentProvider,
  PaymentRequest,
  PaymentRequestResult,
  ProviderCapabilities,
  ProviderId,
  ProviderStatus,
  RawCallback,
  RefundRequest,
  RefundResult,
} from '../payment-provider.interface.js';

/** What a given test number should do. Documented in the payments architecture doc. */
type MockBehaviour =
  | { kind: 'pay'; delayMs: number; deliveries?: number }
  | { kind: 'fail'; delayMs: number; code: FailureCode }
  | { kind: 'reject'; code: FailureCode }
  /** Expires, then confirms late — exercises the EXPIRED → PAID transition. */
  | { kind: 'late_pay'; delayMs: number }
  /** Callback carries an amount that disagrees with our record. Must be refused and alerted. */
  | { kind: 'amount_mismatch'; delayMs: number; amountCents: Cents }
  /** Callback signed with the wrong key. Must be refused. */
  | { kind: 'bad_signature'; delayMs: number }
  /** Provider itself errors — exercises the circuit breaker. */
  | { kind: 'provider_error' }
  /** Never resolves at all. The reconciliation sweep is the only thing that closes it. */
  | { kind: 'silent' };

const TEST_BEHAVIOURS: ReadonlyMap<string, MockBehaviour> = new Map<string, MockBehaviour>([
  ['+258840000001', { kind: 'pay', delayMs: 8_000 }],
  ['+258840000002', { kind: 'pay', delayMs: 75_000 }],
  ['+258840000003', { kind: 'fail', delayMs: 6_000, code: 'insufficient_balance' }],
  ['+258840000004', { kind: 'fail', delayMs: 6_000, code: 'wrong_pin' }],
  ['+258840000005', { kind: 'fail', delayMs: 4_000, code: 'user_cancelled' }],
  ['+258840000006', { kind: 'late_pay', delayMs: 240_000 }],
  ['+258840000007', { kind: 'pay', delayMs: 8_000, deliveries: 3 }],
  ['+258840000008', { kind: 'amount_mismatch', delayMs: 8_000, amountCents: cents(1) }],
  ['+258840000009', { kind: 'bad_signature', delayMs: 8_000 }],
  ['+258840000010', { kind: 'provider_error' }],
  ['+258840000011', { kind: 'reject', code: 'invalid_msisdn' }],
  ['+258840000012', { kind: 'silent' }],
]);

export interface MockWalletConfig {
  readonly providerId: ProviderId;
  readonly callbackSecret: string;
  readonly minDelayMs: number;
  readonly maxDelayMs: number;
  readonly approvalTimeoutSeconds: number;
  /** Set for deterministic CI runs. Leave undefined for varied local behaviour. */
  readonly seed?: number;
}

/**
 * Schedules a callback. Injected rather than calling `setTimeout` directly so tests can drive
 * the clock instead of waiting 90 real seconds for an assertion.
 */
export type Scheduler = (delayMs: number, task: () => void) => void;

/** Delivers a callback back into our own webhook endpoint, standing in for the provider's POST. */
export type CallbackDelivery = (payload: {
  readonly providerId: ProviderId;
  readonly headers: Record<string, string>;
  readonly rawBody: string;
}) => void;

interface MockTransaction {
  readonly providerTxId: string;
  readonly reference: string;
  readonly amountCents: Cents;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  code: FailureCode | null;
}

/** Small deterministic PRNG, so a seeded run reproduces exactly. */
function makeRandom(seed: number | undefined): () => number {
  if (seed === undefined) return Math.random;
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

export class MockWalletProvider implements PaymentProvider {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;

  private readonly config: MockWalletConfig;
  private readonly schedule: Scheduler;
  private readonly deliver: CallbackDelivery;
  private readonly random: () => number;
  private readonly transactions = new Map<string, MockTransaction>();

  constructor(config: MockWalletConfig, deliver: CallbackDelivery, schedule?: Scheduler) {
    this.config = config;
    this.id = config.providerId;
    this.deliver = deliver;
    this.schedule =
      schedule ??
      ((delayMs, task) => {
        const timer = setTimeout(task, delayMs);
        // Never hold the process open in tests or during shutdown.
        if (typeof timer.unref === 'function') timer.unref();
      });
    this.random = makeRandom(config.seed);
    this.capabilities = {
      supportsRefund: true,
      supportsPartialRefund: true,
      supportsDisbursement: true,
      requiresUserApproval: true,
      approvalTimeoutSeconds: config.approvalTimeoutSeconds,
    };
  }

  async requestPayment(request: PaymentRequest): Promise<PaymentRequestResult> {
    const behaviour = this.behaviourFor(request.payerMsisdn);

    if (behaviour.kind === 'provider_error') {
      return {
        outcome: 'rejected',
        code: 'provider_unavailable',
        message: 'O provedor está temporariamente indisponível.',
        retryable: true,
      };
    }

    if (behaviour.kind === 'reject') {
      return {
        outcome: 'rejected',
        code: behaviour.code,
        message: 'O provedor recusou o pedido de pagamento.',
        retryable: false,
      };
    }

    const providerTxId = `MOCK-${this.id.toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    this.transactions.set(providerTxId, {
      providerTxId,
      reference: request.reference,
      amountCents: request.amountCents,
      status: 'pending',
      code: null,
    });

    if (behaviour.kind !== 'silent') {
      this.scheduleCallback(providerTxId, request, behaviour);
    }

    return {
      outcome: 'accepted',
      providerTxId,
      expiresAt: new Date(Date.now() + this.config.approvalTimeoutSeconds * 1000),
    };
  }

  parseCallback(raw: RawCallback): CallbackParseResult {
    const signature = raw.headers['x-nhonga-signature'];
    if (signature === undefined || !this.verifySignature(raw.rawBody, signature)) {
      return { valid: false, reason: 'bad_signature' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.rawBody);
    } catch {
      return { valid: false, reason: 'malformed' };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { valid: false, reason: 'malformed' };
    }

    const body = parsed as Record<string, unknown>;
    const eventId = body['eventId'];
    const providerTxId = body['providerTxId'];
    const reference = body['reference'];
    const status = body['status'];
    const amountCents = body['amountCents'];
    const occurredAt = body['occurredAt'];

    if (
      typeof eventId !== 'string' ||
      typeof providerTxId !== 'string' ||
      typeof reference !== 'string' ||
      typeof amountCents !== 'number' ||
      typeof occurredAt !== 'string' ||
      (status !== 'paid' && status !== 'failed' && status !== 'cancelled')
    ) {
      return { valid: false, reason: 'malformed' };
    }

    const rawCode = body['code'];

    return {
      valid: true,
      providerEventId: eventId,
      providerTxId,
      ourReference: reference,
      status,
      code: typeof rawCode === 'string' ? (rawCode as FailureCode) : null,
      amountCents: cents(amountCents),
      occurredAt: new Date(occurredAt),
    };
  }

  async queryStatus(providerTxId: string): Promise<ProviderStatus> {
    const transaction = this.transactions.get(providerTxId);
    if (transaction === undefined) {
      return { status: 'unknown', providerTxId: null, code: null, amountCents: null };
    }
    return {
      status: transaction.status,
      providerTxId: transaction.providerTxId,
      code: transaction.code,
      amountCents: transaction.amountCents,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    const transaction = this.transactions.get(request.providerTxId);
    if (transaction === undefined || transaction.status !== 'paid') {
      return {
        outcome: 'rejected',
        code: 'unknown',
        message: 'Não existe um pagamento liquidado com esta referência.',
      };
    }
    if (request.amountCents > transaction.amountCents) {
      return {
        outcome: 'rejected',
        code: 'limit_exceeded',
        message: 'O valor do reembolso excede o valor pago.',
      };
    }
    return { outcome: 'accepted', providerRefundId: `MOCK-REF-${randomUUID().slice(0, 8)}` };
  }

  async disburse(request: DisbursementRequest): Promise<DisbursementResult> {
    if (request.amountCents <= 0) {
      return {
        outcome: 'rejected',
        code: 'unknown',
        message: 'O valor do desembolso deve ser positivo.',
      };
    }
    return { outcome: 'accepted', providerTxId: `MOCK-DIS-${randomUUID().slice(0, 8)}` };
  }

  // ── internals ────────────────────────────────────────────────────────────

  private behaviourFor(msisdn: string): MockBehaviour {
    const configured = TEST_BEHAVIOURS.get(msisdn);
    if (configured !== undefined) return configured;

    const span = Math.max(0, this.config.maxDelayMs - this.config.minDelayMs);
    const delayMs = this.config.minDelayMs + Math.floor(this.random() * span);
    return { kind: 'pay', delayMs };
  }

  private scheduleCallback(
    providerTxId: string,
    request: PaymentRequest,
    behaviour: MockBehaviour,
  ): void {
    if (behaviour.kind === 'provider_error' || behaviour.kind === 'reject' || behaviour.kind === 'silent') {
      return;
    }

    const deliveries = behaviour.kind === 'pay' ? (behaviour.deliveries ?? 1) : 1;

    this.schedule(behaviour.delayMs, () => {
      const transaction = this.transactions.get(providerTxId);
      if (transaction === undefined) return;

      let status: 'paid' | 'failed' | 'cancelled' = 'paid';
      let code: FailureCode | null = null;
      let amountCents: Cents = request.amountCents;
      let signWithWrongKey = false;

      switch (behaviour.kind) {
        case 'fail':
          status = behaviour.code === 'user_cancelled' ? 'cancelled' : 'failed';
          code = behaviour.code;
          break;
        case 'amount_mismatch':
          amountCents = behaviour.amountCents;
          break;
        case 'bad_signature':
          signWithWrongKey = true;
          break;
        default:
          break;
      }

      transaction.status = status;
      transaction.code = code;

      for (let i = 0; i < deliveries; i += 1) {
        this.emit({
          providerTxId,
          reference: request.reference,
          status,
          code,
          amountCents,
          signWithWrongKey,
        });
      }
    });
  }

  private emit(input: {
    providerTxId: string;
    reference: string;
    status: 'paid' | 'failed' | 'cancelled';
    code: FailureCode | null;
    amountCents: Cents;
    signWithWrongKey: boolean;
  }): void {
    const body = JSON.stringify({
      // A stable id per delivery attempt, so retries of the *same* event collapse on our
      // unique constraint while genuinely distinct events do not.
      eventId: `MOCK-EVT-${input.providerTxId}`,
      providerTxId: input.providerTxId,
      reference: input.reference,
      status: input.status,
      code: input.code,
      amountCents: input.amountCents,
      occurredAt: new Date().toISOString(),
    });

    const secret = input.signWithWrongKey ? `${this.config.callbackSecret}-wrong` : this.config.callbackSecret;

    this.deliver({
      providerId: this.id,
      headers: {
        'content-type': 'application/json',
        'x-nhonga-signature': signPayload(body, secret),
      },
      rawBody: body,
    });
  }

  private verifySignature(rawBody: string, signature: string): boolean {
    const expected = signPayload(rawBody, this.config.callbackSecret);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}

export function signPayload(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

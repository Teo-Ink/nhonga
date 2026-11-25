/**
 * PawaPay — primary gateway (Bank of Mozambique–licensed PSP).
 *
 * Uses the v2 Payment Page: POST /v2/paymentpage returns a `redirectUrl` to
 * PawaPay's hosted page, where the buyer confirms and approves on their phone.
 * The final outcome is read from GET /v2/deposits/{depositId}.
 *
 * Mozambique collections currently go through Vodacom M-Pesa (VODACOM_MOZ)
 * only; e-Mola is payouts-only on PawaPay, so other wallets fall through to
 * the backup gateway. Extend `methods` when PawaPay enables more providers.
 *
 * Callbacks: PawaPay posts deposit callbacks to the URL configured in its
 * dashboard (not per request). Two independent defences:
 *  1. the signature is verified when present, and demanded when
 *     `requireSignedCallbacks` is on (see pawapay-signature.ts);
 *  2. only the depositId is taken from the body and the status is re-read
 *     from the API, so even an accepted callback cannot credit anything by
 *     itself.
 *
 * Docs: https://docs.pawapay.io/v2/docs/payment_page
 */

import {
  GatewayUnavailableError,
  centsToDecimal,
  decimalToCents,
  requestJson,
  type CheckoutGateway,
  type CreateCheckoutInput,
  type CreatedCheckout,
  type RefundInput,
  type RefundResult,
  type FetchLike,
  type GatewayStatus,
  type PayMethod,
  type WebhookInput,
  type WebhookResult,
} from '../checkout.types.js';
import { PawaPayKeys, verifyCallback, type SignatureCheck } from './pawapay-signature.js';

export interface PawaPayConfig {
  readonly apiToken: string;
  /** https://api.sandbox.pawapay.io (sandbox) or https://api.pawapay.io (live). */
  readonly baseUrl: string;
  /** The callback URL configured in the PawaPay dashboard; the signature
   *  covers its host and path. */
  readonly callbackUrl: string;
  /** Reject callbacks that carry no signature. Turn on once "signed
   *  callbacks" is enabled in the dashboard. */
  readonly requireSignedCallbacks: boolean;
}

/** A Payment Page session lasts 15 minutes; NOT_FOUND after that means abandoned. */
const PAGE_EXPIRY_MS = 15 * 60_000;

export class PawaPayGateway implements CheckoutGateway {
  readonly id = 'pawapay' as const;
  readonly methods: readonly PayMethod[] = ['mpesa'];

  constructor(
    private readonly config: PawaPayConfig,
    private readonly fetchImpl: FetchLike,
    private readonly now: () => number = Date.now,
  ) {
    this.keys = new PawaPayKeys(config.baseUrl, fetchImpl, now);
  }

  private readonly keys: PawaPayKeys;

  private headers(): Record<string, string> {
    return { authorization: `Bearer ${this.config.apiToken}` };
  }

  async create(input: CreateCheckoutInput): Promise<CreatedCheckout> {
    const { status, json } = await requestJson(
      this.fetchImpl,
      this.id,
      `${this.config.baseUrl}/v2/paymentpage`,
      {
        method: 'POST',
        headers: this.headers(),
        body: {
          // Our intent id doubles as the depositId: a retried request cannot
          // create a second deposit.
          depositId: input.intentId,
          returnUrl: input.returnUrl,
          amount: centsToDecimal(input.amountCents),
          country: 'MOZ',
          reason: input.description.slice(0, 50),
          metadata: [{ intentId: input.intentId }],
        },
      },
    );
    const url = (json as { redirectUrl?: unknown } | null)?.redirectUrl;
    if (status >= 400 || typeof url !== 'string') {
      throw new Error(`PawaPay rejected the payment page request (${status}): ${describe(json)}`);
    }
    return { gatewayRef: input.intentId, checkoutUrl: url };
  }

  async status(depositId: string, createdAt?: Date): Promise<GatewayStatus> {
    const { status, json } = await requestJson(
      this.fetchImpl,
      this.id,
      `${this.config.baseUrl}/v2/deposits/${encodeURIComponent(depositId)}`,
      { method: 'GET', headers: this.headers() },
    );
    if (status >= 400) {
      throw new GatewayUnavailableError(this.id, `PawaPay status query failed (${status})`);
    }
    const body = json as {
      status?: string;
      data?: {
        status?: string;
        amount?: unknown;
        failureReason?: { failureCode?: string; failureMessage?: string };
      };
    } | null;

    if (body?.status === 'NOT_FOUND') {
      // The deposit only exists once the buyer presses Pay on the page.
      const abandoned =
        createdAt !== undefined && this.now() - createdAt.getTime() > PAGE_EXPIRY_MS;
      return {
        status: abandoned ? 'failed' : 'pending',
        amountCents: null,
        failureReason: abandoned ? 'Página de pagamento abandonada' : null,
      };
    }
    const d = body?.data;
    switch (d?.status) {
      case 'COMPLETED':
        return { status: 'paid', amountCents: decimalToCents(d.amount), failureReason: null };
      case 'FAILED':
        return {
          status: 'failed',
          amountCents: decimalToCents(d.amount),
          failureReason:
            d.failureReason?.failureCode ?? d.failureReason?.failureMessage ?? 'FAILED',
        };
      default:
        // ACCEPTED, PROCESSING, IN_RECONCILIATION: still in flight.
        return { status: 'pending', amountCents: null, failureReason: null };
    }
  }

  /** POST /v2/refunds: returns the deposit to the payer's wallet. */
  async refund(input: RefundInput): Promise<RefundResult> {
    const { status, json } = await requestJson(
      this.fetchImpl,
      this.id,
      `${this.config.baseUrl}/v2/refunds`,
      {
        method: 'POST',
        headers: this.headers(),
        body: {
          refundId: input.refundId,
          depositId: input.gatewayRef,
          amount: centsToDecimal(input.amountCents),
          currency: 'MZN',
        },
      },
    );
    const body = json as { status?: string; failureReason?: { failureMessage?: string } } | null;
    if (status >= 500)
      throw new GatewayUnavailableError(this.id, `PawaPay refund failed (${status})`);
    if (body?.status === 'ACCEPTED' || body?.status === 'DUPLICATE_IGNORED') {
      return { status: 'accepted', reason: null };
    }
    return {
      status: 'rejected',
      reason: body?.failureReason?.failureMessage ?? `PawaPay recusou o reembolso (${status})`,
    };
  }

  /** GET /v2/refunds/{refundId}. */
  async refundStatus(refundId: string): Promise<RefundResult> {
    const { status, json } = await requestJson(
      this.fetchImpl,
      this.id,
      `${this.config.baseUrl}/v2/refunds/${encodeURIComponent(refundId)}`,
      { method: 'GET', headers: this.headers() },
    );
    if (status >= 400)
      throw new GatewayUnavailableError(this.id, `PawaPay refund status (${status})`);
    const d = (
      json as { data?: { status?: string; failureReason?: { failureMessage?: string } } } | null
    )?.data;
    if (d?.status === 'COMPLETED') return { status: 'completed', reason: null };
    if (d?.status === 'FAILED') {
      return { status: 'rejected', reason: d.failureReason?.failureMessage ?? 'FAILED' };
    }
    return { status: 'accepted', reason: null };
  }

  private async checkSignature(input: WebhookInput): Promise<SignatureCheck> {
    let last: SignatureCheck = { ok: false, reason: 'malformed' };
    for (const callbackUrl of callbackUrlVariants(this.config.callbackUrl)) {
      last = await verifyCallback({
        headers: input.headers,
        rawBody: input.rawBody,
        callbackUrl,
        key: (id) => this.keys.get(id),
        nowMs: this.now(),
      });
      // Only a signature mismatch can depend on which address was registered.
      if (last.ok || last.reason !== 'bad_signature') return last;
    }
    return last;
  }

  async parseWebhook(input: WebhookInput): Promise<WebhookResult> {
    const check = await this.checkSignature(input);
    if (!check.ok && !(check.reason === 'unsigned' && !this.config.requireSignedCallbacks))
      return { valid: false, reason: 'bad_signature', detail: check.reason };
    try {
      const body = JSON.parse(input.rawBody) as {
        depositId?: unknown;
        data?: { depositId?: unknown };
      };
      const id = body.depositId ?? body.data?.depositId;
      return typeof id === 'string' && id.length > 0
        ? { valid: true, gatewayRef: id }
        : { valid: false, reason: 'malformed' };
    } catch {
      return { valid: false, reason: 'malformed' };
    }
  }
}

/** The same route answers with and without the /v1 prefix; accept whichever
 *  of the two was registered in the dashboard. */
export function callbackUrlVariants(callbackUrl: string): string[] {
  try {
    const u = new URL(callbackUrl);
    const other = new URL(callbackUrl);
    other.pathname = u.pathname.startsWith('/v1/')
      ? u.pathname.slice(3)
      : `/v1${u.pathname.startsWith('/') ? '' : '/'}${u.pathname}`;
    return [u.toString(), other.toString()];
  } catch {
    return [callbackUrl];
  }
}

function describe(json: unknown): string {
  if (json && typeof json === 'object') {
    const f = (json as { failureReason?: { failureCode?: string; failureMessage?: string } })
      .failureReason;
    if (f) return `${f.failureCode ?? ''} ${f.failureMessage ?? ''}`.trim();
  }
  return JSON.stringify(json)?.slice(0, 200) ?? 'no body';
}

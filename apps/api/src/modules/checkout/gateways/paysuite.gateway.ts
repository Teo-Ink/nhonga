/**
 * PaySuite — backup gateway, and the route for e-Mola / mKesh / card until
 * PawaPay can collect from them in Mozambique.
 *
 * POST /api/v1/payments returns a `checkout_url` to PaySuite's hosted page;
 * GET /api/v1/payments/{id} is the authoritative status. Webhooks carry an
 * `X-Signature` header: hex HMAC-SHA256 of the raw body with the account's
 * webhook secret. We verify it (constant-time) and still re-read the status
 * before crediting anything.
 *
 * Docs: https://paysuite.tech/docs
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  GatewayUnavailableError,
  centsToDecimal,
  decimalToCents,
  requestJson,
  type CheckoutGateway,
  type CreateCheckoutInput,
  type CreatedCheckout,
  type FetchLike,
  type GatewayStatus,
  type PayMethod,
  type WebhookInput,
  type WebhookResult,
} from '../checkout.types.js';

export interface PaySuiteConfig {
  readonly apiToken: string;
  readonly webhookSecret: string;
  /** https://paysuite.tech */
  readonly baseUrl: string;
}

/** PaySuite references: ASCII letters/digits only, max 50 chars. */
export function paysuiteReference(intentId: string): string {
  return `NHG${intentId.replace(/[^A-Za-z0-9]/g, '')}`.slice(0, 50);
}

/** PaySuite's `method` values for the wallets we offer. */
const METHOD: Partial<Record<PayMethod, string>> = {
  mpesa: 'mpesa',
  emola: 'emola',
  card: 'credit_card',
  // mKesh is listed in PaySuite's payment methods but not in the API's
  // `method` enum; omitting `method` lets the buyer choose it on the page.
};

export class PaySuiteGateway implements CheckoutGateway {
  readonly id = 'paysuite' as const;
  readonly methods: readonly PayMethod[] = ['mpesa', 'emola', 'mkesh', 'card'];

  constructor(
    private readonly config: PaySuiteConfig,
    private readonly fetchImpl: FetchLike,
  ) {}

  private headers(): Record<string, string> {
    return { authorization: `Bearer ${this.config.apiToken}` };
  }

  async create(input: CreateCheckoutInput): Promise<CreatedCheckout> {
    const method = METHOD[input.method];
    const { status, json } = await requestJson(
      this.fetchImpl,
      this.id,
      `${this.config.baseUrl}/api/v1/payments`,
      {
        method: 'POST',
        headers: this.headers(),
        body: {
          amount: centsToDecimal(input.amountCents),
          reference: paysuiteReference(input.intentId),
          description: input.description.slice(0, 125),
          return_url: input.returnUrl,
          webhook_url: input.webhookUrl,
          ...(method ? { method } : {}),
        },
      },
    );
    const data = (json as { data?: { id?: unknown; checkout_url?: unknown } } | null)?.data;
    if (status >= 400 || typeof data?.id !== 'string' || typeof data.checkout_url !== 'string') {
      const msg = (json as { message?: string } | null)?.message ?? `status ${status}`;
      throw new Error(`PaySuite rejected the payment request: ${msg}`);
    }
    return { gatewayRef: data.id, checkoutUrl: data.checkout_url };
  }

  async status(paymentId: string): Promise<GatewayStatus> {
    const { status, json } = await requestJson(
      this.fetchImpl,
      this.id,
      `${this.config.baseUrl}/api/v1/payments/${encodeURIComponent(paymentId)}`,
      { method: 'GET', headers: this.headers() },
    );
    if (status >= 400) {
      throw new GatewayUnavailableError(this.id, `PaySuite status query failed (${status})`);
    }
    const d = (
      json as {
        data?: { status?: string; amount?: unknown; transaction?: { status?: string } | null };
      } | null
    )?.data;
    const s = (d?.transaction?.status ?? d?.status ?? '').toLowerCase();
    if (s === 'completed' || s === 'paid' || s === 'success') {
      return { status: 'paid', amountCents: decimalToCents(d?.amount), failureReason: null };
    }
    if (s === 'failed' || s === 'cancelled' || s === 'canceled' || s === 'expired') {
      return { status: 'failed', amountCents: decimalToCents(d?.amount), failureReason: s };
    }
    return { status: 'pending', amountCents: null, failureReason: null };
  }

  parseWebhook(input: WebhookInput): WebhookResult {
    const given = input.headers['x-signature'] ?? '';
    const expected = createHmac('sha256', this.config.webhookSecret)
      .update(input.rawBody, 'utf8')
      .digest('hex');
    const a = Buffer.from(given, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, reason: 'bad_signature' };
    }
    try {
      const body = JSON.parse(input.rawBody) as { data?: { id?: unknown; payment_id?: unknown } };
      // Refund events carry the payment under payment_id; payments under id.
      const id = body.data?.payment_id ?? body.data?.id;
      return typeof id === 'string' && id.length > 0
        ? { valid: true, gatewayRef: id }
        : { valid: false, reason: 'malformed' };
    } catch {
      return { valid: false, reason: 'malformed' };
    }
  }
}

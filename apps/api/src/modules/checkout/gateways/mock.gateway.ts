/**
 * Development gateway (CHECKOUT_MODE=mock).
 *
 * Behaves like the real ones — returns a hosted page URL and reports status —
 * but the "page" is Nhonga's own /pagamento/simulador screen, where a developer
 * approves or declines. Outcomes live in memory, so a restart resets pending
 * mock payments (which then expire like abandoned real ones).
 */

import type {
  CheckoutGateway,
  CreateCheckoutInput,
  CreatedCheckout,
  GatewayStatus,
  PayMethod,
  WebhookInput,
  WebhookResult,
} from '../checkout.types.js';

export class MockGateway implements CheckoutGateway {
  readonly id = 'mock' as const;
  readonly methods: readonly PayMethod[] = ['mpesa', 'emola', 'card'];
  private readonly outcomes = new Map<
    string,
    { status: 'pending' | 'paid' | 'failed'; amountCents: number }
  >();

  constructor(private readonly webBaseUrl: string) {}

  async create(input: CreateCheckoutInput): Promise<CreatedCheckout> {
    const ref = `mock_${input.intentId}`;
    this.outcomes.set(ref, { status: 'pending', amountCents: input.amountCents });
    return {
      gatewayRef: ref,
      checkoutUrl: `${this.webBaseUrl}/pagamento/simulador/${input.intentId}`,
    };
  }

  async status(gatewayRef: string): Promise<GatewayStatus> {
    const o = this.outcomes.get(gatewayRef);
    if (!o) return { status: 'pending', amountCents: null, failureReason: null };
    return {
      status: o.status,
      amountCents: o.status === 'pending' ? null : o.amountCents,
      failureReason: o.status === 'failed' ? 'Recusado no simulador' : null,
    };
  }

  /** Called by the simulator page (dev only). */
  decide(gatewayRef: string, outcome: 'paid' | 'failed'): boolean {
    const o = this.outcomes.get(gatewayRef);
    if (!o || o.status !== 'pending') return false;
    o.status = outcome;
    return true;
  }

  parseWebhook(input: WebhookInput): WebhookResult {
    void input;
    return { valid: false, reason: 'malformed' };
  }
}

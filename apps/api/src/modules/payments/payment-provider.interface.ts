/**
 * The payment provider contract.
 *
 * Every rail implements this: M-Pesa, e-Mola, mKesh, and cash-on-delivery. COD is deliberately
 * a provider rather than a special case — a forked checkout state machine is where money gets
 * lost (D-22).
 *
 * M-Pesa and e-Mola have no self-service public API. Production credentials require signed
 * merchant agreements with Vodacom and Movitel (OQ-7, OQ-8), which take 4–12 weeks and which we
 * cannot obtain ourselves. This interface exists so the entire checkout experience is built and
 * tested today against a mock that reproduces the real protocol, and the production swap is one
 * factory function plus credentials.
 *
 * See docs/phase-2-architecture/04-payments-architecture.md.
 */

import type { Cents } from '@nhoga/shared';

export type ProviderId = 'mpesa' | 'emola' | 'mkesh' | 'cod';

/**
 * Normalised failure reasons. Providers report failures in their own vocabulary; each adapter
 * maps them onto this set so the rest of the system — and the buyer-facing copy — has one
 * vocabulary to handle.
 */
export type FailureCode =
  | 'insufficient_balance'
  | 'wrong_pin'
  | 'user_cancelled'
  | 'timeout'
  | 'provider_unavailable'
  | 'invalid_msisdn'
  | 'limit_exceeded'
  /** We could not determine the outcome. Never tell the buyer this means failure — they may
   *  have been debited. See the error taxonomy in 05-states-and-connectivity.md. */
  | 'unknown';

export interface ProviderCapabilities {
  readonly supportsRefund: boolean;
  readonly supportsPartialRefund: boolean;
  /** Whether we can pay a vendor out through this rail. e-Mola's support is unconfirmed — OQ-16. */
  readonly supportsDisbursement: boolean;
  /** False for COD, which settles physically rather than by handset approval. */
  readonly requiresUserApproval: boolean;
  readonly approvalTimeoutSeconds: number;
}

export interface PaymentRequest {
  /** Our payment row id. */
  readonly paymentId: string;
  /** Passed to the provider so a retried network call cannot become a second charge. */
  readonly idempotencyKey: string;
  readonly amountCents: Cents;
  readonly currency: 'MZN';
  /** E.164, already normalised by `@nhoga/shared`. */
  readonly payerMsisdn: string;
  /** Appears on the payer's SMS receipt. Keep it recognisable — buyers reconcile against it. */
  readonly reference: string;
  readonly description: string;
}

export type PaymentRequestResult =
  | {
      readonly outcome: 'accepted';
      readonly providerTxId: string;
      readonly expiresAt: Date;
    }
  | {
      readonly outcome: 'rejected';
      readonly code: FailureCode;
      readonly message: string;
      readonly retryable: boolean;
    };

export interface RawCallback {
  readonly headers: Readonly<Record<string, string | undefined>>;
  /** The exact bytes received. Signature verification must run against these, not against a
   *  re-serialised object — key order and whitespace change the digest. */
  readonly rawBody: string;
}

export type CallbackParseResult =
  | {
      readonly valid: false;
      readonly reason: 'bad_signature' | 'malformed' | 'unknown_provider';
    }
  | {
      readonly valid: true;
      /** Used for the `UNIQUE (provider, provider_event_id)` constraint that makes duplicate
       *  webhook delivery a database no-op rather than something code must remember to check. */
      readonly providerEventId: string;
      readonly providerTxId: string;
      /** Our reference, echoed back. Cross-checked against the payment row. */
      readonly ourReference: string;
      readonly status: 'paid' | 'failed' | 'cancelled';
      readonly code: FailureCode | null;
      /** Verified against our recorded amount before the event is accepted. We do not trust an
       *  external payload to tell us what we charged. */
      readonly amountCents: Cents;
      readonly occurredAt: Date;
    };

export interface ProviderStatus {
  readonly status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'unknown';
  readonly providerTxId: string | null;
  readonly code: FailureCode | null;
  readonly amountCents: Cents | null;
}

export interface RefundRequest {
  readonly paymentId: string;
  readonly providerTxId: string;
  readonly idempotencyKey: string;
  readonly amountCents: Cents;
  readonly reason: string;
}

export type RefundResult =
  | { readonly outcome: 'accepted'; readonly providerRefundId: string }
  | { readonly outcome: 'rejected'; readonly code: FailureCode; readonly message: string };

export interface DisbursementRequest {
  readonly settlementBatchId: string;
  readonly idempotencyKey: string;
  readonly amountCents: Cents;
  readonly recipientMsisdn: string;
  readonly reference: string;
}

export type DisbursementResult =
  | { readonly outcome: 'accepted'; readonly providerTxId: string }
  | { readonly outcome: 'rejected'; readonly code: FailureCode; readonly message: string };

export interface PaymentProvider {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;

  /**
   * Initiate a push / USSD request-to-pay. Returns as soon as the provider acknowledges;
   * the buyer approves on their handset afterwards, typically in 10–120 seconds.
   */
  requestPayment(request: PaymentRequest): Promise<PaymentRequestResult>;

  /**
   * Verify and normalise an inbound webhook.
   *
   * **Must be pure** — no database writes, no network calls, no logging side effects. This is
   * the only code that touches an unauthenticated external payload, and keeping it free of
   * side effects means signature verification and persistence cannot be accidentally reordered
   * by a later change.
   */
  parseCallback(raw: RawCallback): CallbackParseResult;

  /**
   * Authoritative status query. The reconciliation path when a webhook is late or never
   * arrives — which is why correctness never depends on callback delivery (D-23).
   */
  queryStatus(providerTxId: string): Promise<ProviderStatus>;

  refund(request: RefundRequest): Promise<RefundResult>;

  /** Optional: not every rail can pay a vendor out programmatically. */
  disburse?(request: DisbursementRequest): Promise<DisbursementResult>;
}

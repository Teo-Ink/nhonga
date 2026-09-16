/**
 * Cash on delivery.
 *
 * COD implements the same interface as the wallets so the checkout state machine stays
 * single-path (D-22). It is not a grudging fallback: for many first-time buyers it is the only
 * acceptable way to make a first purchase, and the first purchase is the one that converts a
 * sceptic into a customer.
 *
 * The honest part of this adapter is what it does **not** claim. `requestPayment` accepts the
 * order so fulfilment can proceed, but the payment stays unsettled — money has not moved. The
 * sub-order advances on `payment_deferred`, never on `payment_settled`, so nothing in the audit
 * trail or the settlement engine believes we hold funds we do not hold.
 *
 * Settlement direction for COD is an open question — the vendor or courier collects the cash and
 * therefore *owes* the platform its commission, which inverts the normal payout flow. See
 * OPEN_QUESTIONS.md OQ-18.
 */

import { randomUUID } from 'node:crypto';
import type {
  CallbackParseResult,
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

export class CodProvider implements PaymentProvider {
  readonly id: ProviderId = 'cod';

  readonly capabilities: ProviderCapabilities = {
    supportsRefund: false,
    supportsPartialRefund: false,
    supportsDisbursement: false,
    /** Nothing to approve on a handset — the buyer approves by opening their door. */
    requiresUserApproval: false,
    approvalTimeoutSeconds: 0,
  };

  async requestPayment(request: PaymentRequest): Promise<PaymentRequestResult> {
    // Accepted immediately: there is no external system to ask. The order may be fulfilled;
    // the payment itself is settled by the courier at handover, recorded through the delivery
    // flow rather than through a provider callback.
    return {
      outcome: 'accepted',
      providerTxId: `COD-${request.paymentId}-${randomUUID().slice(0, 8).toUpperCase()}`,
      // No approval window applies. Expiry is governed by the order's own lifecycle.
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    };
  }

  parseCallback(_raw: RawCallback): CallbackParseResult {
    // COD has no external provider, so nothing can legitimately call back on its behalf.
    // Anything arriving here is misrouted or hostile.
    return { valid: false, reason: 'unknown_provider' };
  }

  async queryStatus(providerTxId: string): Promise<ProviderStatus> {
    // There is no remote to query. Truth lives in our own delivery records, and the caller
    // must not interpret this as evidence of payment either way.
    return {
      status: 'pending',
      providerTxId,
      code: null,
      amountCents: null,
    };
  }

  async refund(_request: RefundRequest): Promise<RefundResult> {
    // Cash refunds happen in person and are recorded as a manual adjustment on the settlement,
    // not as a provider operation. Returning "rejected" rather than throwing keeps the refund
    // pipeline single-path; the caller routes COD refunds to the operations queue.
    return {
      outcome: 'rejected',
      code: 'unknown',
      message: 'Reembolsos de pagamentos contra-entrega são processados manualmente.',
    };
  }
}

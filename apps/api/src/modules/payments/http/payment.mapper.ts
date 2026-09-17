import { PAYMENT_STATUSES, type PaymentStatus } from '@nhonga/shared';
import type { ProviderId } from '../payment-provider.interface.js';
import { FALLBACK_FAILURE_MESSAGE, isFailureCode, retryabilityOf } from './retryability.js';

/** The `Payment` schema from openapi.yaml, as returned by GET /payments/{id}. */
export interface PaymentResponse {
  readonly id: string;
  readonly orderId: string;
  readonly provider: ProviderId;
  readonly status: PaymentStatus;
  readonly amountCents: number;
  readonly providerRef: string | null;
  readonly expiresAt: string;
  readonly failure: {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
  } | null;
}

/** The columns the mapper needs. A structural subset of the payment row so the
 *  mapper can be unit-tested without a database. */
export interface PaymentRow {
  readonly id: string;
  readonly orderId: string;
  readonly provider: string;
  readonly status: string;
  readonly amountCents: number;
  readonly providerRef: string | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly expiresAt: Date;
}

const PROVIDERS = new Set<string>(['mpesa', 'emola', 'mkesh', 'cod']);
const STATES = new Set<string>(PAYMENT_STATUSES);

/**
 * Thrown when a stored value is not in the contract's enum. Serving an
 * out-of-contract value to clients is worse than failing the request: a client
 * that receives an unrecognised payment status may make the one wrong decision
 * this product cannot afford. Surfaced as a 500 by the global filter.
 */
export class PaymentMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentMappingError';
  }
}

export function toPaymentResponse(row: PaymentRow): PaymentResponse {
  if (!PROVIDERS.has(row.provider)) {
    throw new PaymentMappingError(`Payment ${row.id} has unknown provider "${row.provider}"`);
  }
  if (!STATES.has(row.status)) {
    throw new PaymentMappingError(`Payment ${row.id} has unknown status "${row.status}"`);
  }

  let failure: PaymentResponse['failure'] = null;
  if (row.failureCode !== null) {
    if (!isFailureCode(row.failureCode)) {
      throw new PaymentMappingError(
        `Payment ${row.id} has unknown failure code "${row.failureCode}"`,
      );
    }
    failure = {
      code: row.failureCode,
      message: row.failureMessage ?? FALLBACK_FAILURE_MESSAGE[row.failureCode],
      retryable: retryabilityOf(row.failureCode),
    };
  }

  // maskedMsisdn is intentionally omitted. Producing "84 *** 4567" requires
  // decrypting msisdn_encrypted through the KMS-backed field cipher, which is
  // not built yet (the same dependency checkout needs). The field is optional
  // in the contract; a wrong or fabricated mask is not an acceptable stand-in.
  return {
    id: row.id,
    orderId: row.orderId,
    provider: row.provider as ProviderId,
    status: row.status as PaymentStatus,
    amountCents: row.amountCents,
    providerRef: row.providerRef,
    expiresAt: row.expiresAt.toISOString(),
    failure,
  };
}

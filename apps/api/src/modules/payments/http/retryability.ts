import type { FailureCode } from '../payment-provider.interface.js';

/**
 * Whether a failed payment can be retried, keyed by failure code.
 *
 * This is not an invented policy: it is read directly off the error taxonomy
 * in docs/phase-1-design/05-states-and-connectivity.md §4, which specifies the
 * actions offered to the buyer for each cause. "Retry" or "Change method" in
 * that table means retryable at the payment level, because the retry endpoint
 * may switch provider on the new attempt.
 *
 * The one that matters is `unknown`. The taxonomy is explicit: we must never
 * tell a buyer a payment failed when we do not know, because they may have been
 * debited. `unknown` therefore offers "Go to orders", not a retry, and
 * reconciliation resolves it server-side.
 */
const RETRYABLE: Record<FailureCode, boolean> = {
  insufficient_balance: true, // "Retry · Change method · Try COD"
  wrong_pin: true, //            "Retry"
  user_cancelled: true, //       "Retry · Change method"
  timeout: true, //              "Retry · Change method"
  provider_unavailable: true, // "Try e-Mola · Try COD" (retry via provider switch)
  invalid_msisdn: true, //       correct the number, new attempt
  limit_exceeded: true, //       try later or change method
  unknown: false, //             never presented as failure; reconciliation owns it
};

export function retryabilityOf(code: FailureCode): boolean {
  return RETRYABLE[code];
}

/**
 * Safe fallback display copy, used only when the payment row has no stored
 * message. The stored message is preferred; these mirror the taxonomy so a
 * failed payment is never rendered with an empty explanation.
 */
export const FALLBACK_FAILURE_MESSAGE: Record<FailureCode, string> = {
  insufficient_balance: 'Saldo insuficiente na sua conta.',
  wrong_pin: 'PIN incorrecto. Tente novamente.',
  user_cancelled: 'Cancelou o pagamento.',
  timeout: 'O pedido expirou. Não foi cobrado nada.',
  provider_unavailable: 'O provedor está temporariamente indisponível.',
  invalid_msisdn: 'O número deve ter 9 dígitos, começando por 8.',
  limit_exceeded: 'Limite de transacção excedido. Tente mais tarde.',
  unknown:
    'Não conseguimos confirmar o pagamento. Estamos a verificar — avisamos por SMS em minutos.',
};

const FAILURE_CODES = new Set<string>(Object.keys(RETRYABLE));

export function isFailureCode(value: string): value is FailureCode {
  return FAILURE_CODES.has(value);
}

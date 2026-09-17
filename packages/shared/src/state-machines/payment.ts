/**
 * Payment state machine.
 *
 * Mobile-money push payments are asynchronous over a channel we do not control. A callback can
 * arrive late, twice, out of order, or never — while the buyer's handset already shows success.
 * Ad-hoc boolean flags (`isPaid`, `isConfirmed`) cannot survive that, and the bugs they produce
 * are the ones that lose real money.
 *
 * This module is the single definition of legal payment transitions, imported unchanged by the
 * API, the web app, and the mobile app. See DECISIONS.md D-14 and D-22, and
 * docs/phase-2-architecture/04-payments-architecture.md §3.
 *
 * Two rules the implementation enforces rather than documents:
 *
 *   1. An event that would re-apply the state we are already in is a **no-op, not an error**.
 *      Duplicate webhook delivery is routine. Throwing on it would page someone at 3am for
 *      correct behaviour.
 *
 *   2. `EXPIRED` is not terminal. A buyer can approve on their handset after our window closed;
 *      the money leaves their wallet either way. `EXPIRED → PAID` exists so a late confirmation
 *      is honoured instead of stranding a debited customer with no order.
 */

export const PAYMENT_STATUSES = [
  'initiated',
  'awaiting_user',
  'paid',
  'failed',
  'expired',
  'refund_pending',
  'refunded',
  'refund_failed',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_EVENT_TYPES = [
  /** The provider accepted our request-to-pay and pushed a prompt to the handset. */
  'provider_accepted',
  /** The provider refused the request outright — bad MSISDN, limit, provider-side validation. */
  'provider_rejected',
  /** Confirmed settled, by signed webhook or by an authoritative status query. */
  'confirmed_paid',
  /** Confirmed not settled — wrong PIN, insufficient balance, buyer declined. */
  'confirmed_failed',
  /** Our approval window elapsed with no resolution. Not a failure — see the module note. */
  'expired',
  'refund_requested',
  'refund_succeeded',
  'refund_rejected',
] as const;

export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];

type TransitionTable = Readonly<
  Record<PaymentStatus, Readonly<Partial<Record<PaymentEventType, PaymentStatus>>>>
>;

export const PAYMENT_TRANSITIONS: TransitionTable = Object.freeze({
  initiated: Object.freeze({
    provider_accepted: 'awaiting_user',
    provider_rejected: 'failed',
  }),
  awaiting_user: Object.freeze({
    confirmed_paid: 'paid',
    confirmed_failed: 'failed',
    expired: 'expired',
  }),
  // Not terminal. The late sweep re-queries the provider for 72 hours after expiry.
  expired: Object.freeze({
    confirmed_paid: 'paid',
    confirmed_failed: 'failed',
  }),
  paid: Object.freeze({
    refund_requested: 'refund_pending',
  }),
  refund_pending: Object.freeze({
    refund_succeeded: 'refunded',
    refund_rejected: 'refund_failed',
  }),
  // A failed disbursement can be retried once operations has resolved the cause.
  refund_failed: Object.freeze({
    refund_requested: 'refund_pending',
  }),
  failed: Object.freeze({}),
  refunded: Object.freeze({}),
}) as TransitionTable;

/** States from which no transition is possible. Note `expired` is deliberately absent. */
export const TERMINAL_PAYMENT_STATUSES: ReadonlySet<PaymentStatus> = new Set<PaymentStatus>([
  'failed',
  'refunded',
]);

/**
 * For each status, the events that could legitimately have produced it.
 *
 * This is what lets us tell "duplicate callback" apart from "illegal transition". A
 * `confirmed_paid` arriving at a payment already in `paid` is the provider retrying, which is
 * normal and must be inert. A `refund_succeeded` arriving there is a genuine inconsistency
 * worth alerting on.
 */
const EVENTS_PRODUCING: Readonly<Record<PaymentStatus, ReadonlySet<PaymentEventType>>> = (() => {
  const map = new Map<PaymentStatus, Set<PaymentEventType>>();
  for (const status of PAYMENT_STATUSES) map.set(status, new Set<PaymentEventType>());

  for (const from of PAYMENT_STATUSES) {
    const row = PAYMENT_TRANSITIONS[from];
    for (const eventType of PAYMENT_EVENT_TYPES) {
      const target = row[eventType];
      if (target !== undefined) map.get(target)?.add(eventType);
    }
  }

  const frozen: Partial<Record<PaymentStatus, ReadonlySet<PaymentEventType>>> = {};
  for (const status of PAYMENT_STATUSES) {
    frozen[status] = map.get(status) ?? new Set<PaymentEventType>();
  }
  return Object.freeze(frozen) as Readonly<Record<PaymentStatus, ReadonlySet<PaymentEventType>>>;
})();

export type PaymentTransitionResult =
  | { readonly changed: true; readonly from: PaymentStatus; readonly to: PaymentStatus }
  | {
      readonly changed: false;
      readonly from: PaymentStatus;
      readonly reason: 'already_applied' | 'terminal' | 'illegal_transition';
    };

/**
 * Apply an event to a payment status.
 *
 * Pure. Never throws — an unexpected event is a result, not an exception, because this runs
 * against payloads from an external system we do not control and the caller needs to decide
 * what to log rather than having a stack trace thrown at it.
 *
 * `already_applied` is the normal outcome of a duplicate webhook: log at debug, return 200,
 * change nothing. `illegal_transition` means the provider told us something inconsistent with
 * our record and deserves an alert.
 */
export function applyPaymentEvent(
  current: PaymentStatus,
  eventType: PaymentEventType,
): PaymentTransitionResult {
  const target = PAYMENT_TRANSITIONS[current][eventType];

  if (target !== undefined) {
    return { changed: true, from: current, to: target };
  }

  if (EVENTS_PRODUCING[current].has(eventType)) {
    return { changed: false, from: current, reason: 'already_applied' };
  }

  if (TERMINAL_PAYMENT_STATUSES.has(current)) {
    return { changed: false, from: current, reason: 'terminal' };
  }

  return { changed: false, from: current, reason: 'illegal_transition' };
}

export function canApplyPaymentEvent(current: PaymentStatus, eventType: PaymentEventType): boolean {
  return PAYMENT_TRANSITIONS[current][eventType] !== undefined;
}

export function isPaymentTerminal(status: PaymentStatus): boolean {
  return TERMINAL_PAYMENT_STATUSES.has(status);
}

/** Money has settled and the order may proceed to fulfilment. */
export function isPaymentSettled(status: PaymentStatus): boolean {
  return status === 'paid';
}

/**
 * The buyer is waiting on their handset. The client shows the pending screen and polls; the
 * server has already scheduled reconciliation independently.
 */
export function isPaymentPending(status: PaymentStatus): boolean {
  return status === 'initiated' || status === 'awaiting_user';
}

/**
 * Whether a new attempt may be started against the same order.
 *
 * A retry always creates a **new** payment row with a fresh idempotency key, so it is never
 * collapsed into the prior attempt while a true duplicate of that attempt still is. This is why
 * `failed` is terminal for its own row rather than looping back to `initiated`.
 */
export function canRetryPayment(status: PaymentStatus): boolean {
  return status === 'failed' || status === 'expired';
}

/**
 * Whether reconciliation should keep querying the provider for this payment.
 *
 * `expired` is included: for the configured late-sweep window we keep asking, because the
 * alternative is a buyer whose wallet was debited and whose order never existed.
 */
export function requiresReconciliation(status: PaymentStatus): boolean {
  return status === 'initiated' || status === 'awaiting_user' || status === 'expired';
}

/** Whether a settled payment can still be refunded. */
export function canRefund(status: PaymentStatus): boolean {
  return status === 'paid' || status === 'refund_failed';
}

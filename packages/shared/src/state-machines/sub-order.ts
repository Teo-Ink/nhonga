/**
 * Sub-order state machine.
 *
 * State lives on the **sub-order**, never on the order (D-11). A two-vendor order genuinely has
 * two independent lifecycles — one half can be delivered while the other is still being packed —
 * so there is no single truthful `order.status` to store. The order-level status the buyer sees
 * is derived from these, by `rollupOrderStatus()` below.
 *
 * Each transition also declares which actors may trigger it. Authorisation is part of the state
 * machine rather than scattered through controllers, because "a vendor marked someone else's
 * parcel delivered" is an authorisation bug that looks like a workflow bug.
 */

export const SUB_ORDER_STATUSES = [
  'awaiting_payment',
  'confirmed',
  'preparing',
  'shipped',
  'in_transit',
  'delivered',
  'completed',
  'cancelled',
  'disputed',
  'refunded',
] as const;

export type SubOrderStatus = (typeof SUB_ORDER_STATUSES)[number];

export const SUB_ORDER_EVENT_TYPES = [
  'payment_settled',
  /**
   * Cash on delivery: the payment obligation is deferred, not satisfied, but fulfilment may
   * proceed. Kept distinct from `payment_settled` so the audit trail never claims money arrived
   * when it did not — and so settlement eligibility can treat COD differently (OQ-18).
   */
  'payment_deferred',
  'payment_failed',
  'buyer_cancelled',
  'vendor_accepted',
  'vendor_declined',
  'vendor_response_timeout',
  'marked_shipped',
  'marked_in_transit',
  'marked_delivered',
  'buyer_confirmed_receipt',
  'auto_completed',
  'dispute_opened',
  'dispute_resolved_for_buyer',
  'dispute_resolved_for_vendor',
  'admin_cancelled',
] as const;

export type SubOrderEventType = (typeof SUB_ORDER_EVENT_TYPES)[number];

export type ActorType = 'buyer' | 'vendor' | 'admin' | 'system';

type TransitionTable = Readonly<
  Record<SubOrderStatus, Readonly<Partial<Record<SubOrderEventType, SubOrderStatus>>>>
>;

export const SUB_ORDER_TRANSITIONS: TransitionTable = Object.freeze({
  awaiting_payment: Object.freeze({
    payment_settled: 'confirmed',
    payment_deferred: 'confirmed',
    payment_failed: 'cancelled',
    buyer_cancelled: 'cancelled',
    admin_cancelled: 'cancelled',
  }),
  confirmed: Object.freeze({
    vendor_accepted: 'preparing',
    vendor_declined: 'cancelled',
    // An unanswered order is worse for buyer trust than a declined one, so silence auto-cancels.
    vendor_response_timeout: 'cancelled',
    buyer_cancelled: 'cancelled',
    admin_cancelled: 'cancelled',
  }),
  preparing: Object.freeze({
    marked_shipped: 'shipped',
    admin_cancelled: 'cancelled',
  }),
  shipped: Object.freeze({
    marked_in_transit: 'in_transit',
    marked_delivered: 'delivered',
    admin_cancelled: 'cancelled',
  }),
  in_transit: Object.freeze({
    marked_delivered: 'delivered',
    admin_cancelled: 'cancelled',
  }),
  delivered: Object.freeze({
    buyer_confirmed_receipt: 'completed',
    // Fires 7 days after delivery. Without it, vendor payouts are stranded indefinitely by
    // ordinary buyer inattention.
    auto_completed: 'completed',
    dispute_opened: 'disputed',
  }),
  // Still disputable inside the window — completion is a settlement trigger, not a waiver.
  completed: Object.freeze({
    dispute_opened: 'disputed',
  }),
  disputed: Object.freeze({
    dispute_resolved_for_buyer: 'refunded',
    dispute_resolved_for_vendor: 'completed',
  }),
  cancelled: Object.freeze({}),
  refunded: Object.freeze({}),
}) as TransitionTable;

/** Who may trigger each event. `system` covers scheduled jobs and internal event handlers. */
export const EVENT_ACTORS: Readonly<Record<SubOrderEventType, ReadonlySet<ActorType>>> =
  Object.freeze({
    payment_settled: new Set<ActorType>(['system']),
    payment_deferred: new Set<ActorType>(['system']),
    payment_failed: new Set<ActorType>(['system']),
    buyer_cancelled: new Set<ActorType>(['buyer']),
    vendor_accepted: new Set<ActorType>(['vendor']),
    vendor_declined: new Set<ActorType>(['vendor']),
    vendor_response_timeout: new Set<ActorType>(['system']),
    marked_shipped: new Set<ActorType>(['vendor', 'admin']),
    marked_in_transit: new Set<ActorType>(['vendor', 'admin', 'system']),
    marked_delivered: new Set<ActorType>(['vendor', 'admin', 'system']),
    buyer_confirmed_receipt: new Set<ActorType>(['buyer']),
    auto_completed: new Set<ActorType>(['system']),
    dispute_opened: new Set<ActorType>(['buyer']),
    dispute_resolved_for_buyer: new Set<ActorType>(['admin']),
    dispute_resolved_for_vendor: new Set<ActorType>(['admin']),
    admin_cancelled: new Set<ActorType>(['admin']),
  });

export const TERMINAL_SUB_ORDER_STATUSES: ReadonlySet<SubOrderStatus> = new Set<SubOrderStatus>([
  'cancelled',
  'refunded',
]);

export type SubOrderTransitionResult =
  | { readonly changed: true; readonly from: SubOrderStatus; readonly to: SubOrderStatus }
  | {
      readonly changed: false;
      readonly from: SubOrderStatus;
      readonly reason: 'illegal_transition' | 'terminal' | 'forbidden_actor';
    };

/**
 * Apply an event to a sub-order.
 *
 * Authorisation is checked first: an actor who may not trigger an event gets `forbidden_actor`
 * regardless of whether the transition would otherwise be legal, so an audit of refusals
 * distinguishes "wrong time" from "wrong person".
 */
export function applySubOrderEvent(
  current: SubOrderStatus,
  eventType: SubOrderEventType,
  actor: ActorType,
): SubOrderTransitionResult {
  if (!EVENT_ACTORS[eventType].has(actor)) {
    return { changed: false, from: current, reason: 'forbidden_actor' };
  }

  const target = SUB_ORDER_TRANSITIONS[current][eventType];
  if (target !== undefined) {
    return { changed: true, from: current, to: target };
  }

  if (TERMINAL_SUB_ORDER_STATUSES.has(current)) {
    return { changed: false, from: current, reason: 'terminal' };
  }

  return { changed: false, from: current, reason: 'illegal_transition' };
}

export function isSubOrderTerminal(status: SubOrderStatus): boolean {
  return TERMINAL_SUB_ORDER_STATUSES.has(status);
}

/** Settlement becomes eligible at completion, not at delivery — the dispute window sits between. */
export function isSettlementEligible(status: SubOrderStatus): boolean {
  return status === 'completed';
}

/** Funds are withheld from the vendor's next payout while a sub-order is contested. */
export function isSettlementHeld(status: SubOrderStatus): boolean {
  return status === 'disputed';
}

export function canBuyerDispute(status: SubOrderStatus): boolean {
  return status === 'delivered' || status === 'completed';
}

export function canBuyerConfirmReceipt(status: SubOrderStatus): boolean {
  return status === 'delivered';
}

export function canVendorAct(status: SubOrderStatus): boolean {
  return status === 'confirmed' || status === 'preparing' || status === 'shipped' || status === 'in_transit';
}

/** Whether stock reserved for this sub-order should be returned to the catalogue. */
export function shouldReleaseStock(status: SubOrderStatus): boolean {
  return status === 'cancelled' || status === 'refunded';
}

// ─────────────────────────────────────────────────────────────────────────────
// Order-level rollup
// ─────────────────────────────────────────────────────────────────────────────

export const ORDER_ROLLUP_STATUSES = [
  'awaiting_payment',
  'confirmed',
  'partially_shipped',
  'shipped',
  'partially_delivered',
  'delivered',
  'completed',
  'cancelled',
  'disputed',
] as const;

export type OrderRollupStatus = (typeof ORDER_ROLLUP_STATUSES)[number];

/**
 * Derive the single status shown on the order list from its sub-orders.
 *
 * For display only. Nothing writes this to the database — a stored rollup would drift out of
 * sync with its children, and that drift shows up as a lie in the buyer's order timeline.
 *
 * Precedence is chosen by what the buyer most needs to know: a contested sub-order outranks
 * everything, then whether anything is still unpaid, then the least-advanced shipment.
 */
export function rollupOrderStatus(statuses: readonly SubOrderStatus[]): OrderRollupStatus {
  if (statuses.length === 0) return 'awaiting_payment';

  if (statuses.includes('disputed')) return 'disputed';
  if (statuses.every((status) => status === 'cancelled' || status === 'refunded')) {
    return 'cancelled';
  }
  if (statuses.includes('awaiting_payment')) return 'awaiting_payment';

  // Ignore cancelled siblings when judging progress — a cancelled half should not hold the
  // whole order at "confirmed" while the other half is genuinely in transit.
  const live = statuses.filter(
    (status) => status !== 'cancelled' && status !== 'refunded',
  );
  if (live.length === 0) return 'cancelled';

  const liveEvery = (predicate: (status: SubOrderStatus) => boolean): boolean =>
    live.every(predicate);
  const liveSome = (predicate: (status: SubOrderStatus) => boolean): boolean =>
    live.some(predicate);

  if (liveEvery((status) => status === 'completed')) return 'completed';
  if (liveEvery((status) => status === 'delivered' || status === 'completed')) return 'delivered';
  if (liveSome((status) => status === 'delivered' || status === 'completed')) {
    return 'partially_delivered';
  }
  if (liveEvery((status) => status === 'shipped' || status === 'in_transit')) return 'shipped';
  if (liveSome((status) => status === 'shipped' || status === 'in_transit')) {
    return 'partially_shipped';
  }

  return 'confirmed';
}

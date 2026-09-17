import { describe, expect, it } from 'vitest';
import {
  applySubOrderEvent,
  canBuyerConfirmReceipt,
  canBuyerDispute,
  isSettlementEligible,
  isSettlementHeld,
  rollupOrderStatus,
  shouldReleaseStock,
  SUB_ORDER_EVENT_TYPES,
  SUB_ORDER_STATUSES,
  SUB_ORDER_TRANSITIONS,
  type SubOrderStatus,
} from './sub-order.js';

describe('the fulfilment path', () => {
  it('walks payment through to completion', () => {
    expect(applySubOrderEvent('awaiting_payment', 'payment_settled', 'system')).toEqual({
      changed: true,
      from: 'awaiting_payment',
      to: 'confirmed',
    });
    expect(applySubOrderEvent('confirmed', 'vendor_accepted', 'vendor')).toEqual({
      changed: true,
      from: 'confirmed',
      to: 'preparing',
    });
    expect(applySubOrderEvent('preparing', 'marked_shipped', 'vendor')).toEqual({
      changed: true,
      from: 'preparing',
      to: 'shipped',
    });
    expect(applySubOrderEvent('shipped', 'marked_delivered', 'vendor')).toEqual({
      changed: true,
      from: 'shipped',
      to: 'delivered',
    });
    expect(applySubOrderEvent('delivered', 'buyer_confirmed_receipt', 'buyer')).toEqual({
      changed: true,
      from: 'delivered',
      to: 'completed',
    });
  });

  it('auto-completes after the confirmation window so payouts are not stranded', () => {
    expect(applySubOrderEvent('delivered', 'auto_completed', 'system')).toEqual({
      changed: true,
      from: 'delivered',
      to: 'completed',
    });
  });

  it('lets a cash-on-delivery order proceed without claiming money arrived', () => {
    expect(applySubOrderEvent('awaiting_payment', 'payment_deferred', 'system')).toEqual({
      changed: true,
      from: 'awaiting_payment',
      to: 'confirmed',
    });
  });

  it('auto-cancels a vendor who never answers', () => {
    expect(applySubOrderEvent('confirmed', 'vendor_response_timeout', 'system')).toEqual({
      changed: true,
      from: 'confirmed',
      to: 'cancelled',
    });
  });
});

describe('actor authorisation', () => {
  it('refuses a buyer marking their own parcel delivered', () => {
    expect(applySubOrderEvent('shipped', 'marked_delivered', 'buyer')).toEqual({
      changed: false,
      from: 'shipped',
      reason: 'forbidden_actor',
    });
  });

  it('refuses a vendor confirming receipt on the buyer’s behalf', () => {
    expect(applySubOrderEvent('delivered', 'buyer_confirmed_receipt', 'vendor')).toEqual({
      changed: false,
      from: 'delivered',
      reason: 'forbidden_actor',
    });
  });

  it('refuses a vendor resolving a dispute in their own favour', () => {
    expect(applySubOrderEvent('disputed', 'dispute_resolved_for_vendor', 'vendor')).toEqual({
      changed: false,
      from: 'disputed',
      reason: 'forbidden_actor',
    });
  });

  it('distinguishes wrong-person from wrong-time', () => {
    // Wrong person, even though the transition itself is legal here.
    expect(applySubOrderEvent('confirmed', 'vendor_accepted', 'buyer').changed).toBe(false);
    expect(applySubOrderEvent('confirmed', 'vendor_accepted', 'buyer')).toHaveProperty(
      'reason',
      'forbidden_actor',
    );

    // Right person, wrong time.
    expect(applySubOrderEvent('delivered', 'vendor_accepted', 'vendor')).toHaveProperty(
      'reason',
      'illegal_transition',
    );
  });

  it('never throws, for any status, event, and actor', () => {
    for (const status of SUB_ORDER_STATUSES) {
      for (const eventType of SUB_ORDER_EVENT_TYPES) {
        for (const actor of ['buyer', 'vendor', 'admin', 'system'] as const) {
          expect(() => applySubOrderEvent(status, eventType, actor)).not.toThrow();
        }
      }
    }
  });
});

describe('disputes', () => {
  it('can be opened from delivered and from completed', () => {
    expect(applySubOrderEvent('delivered', 'dispute_opened', 'buyer').changed).toBe(true);
    expect(applySubOrderEvent('completed', 'dispute_opened', 'buyer').changed).toBe(true);
  });

  it('resolves to refunded or back to completed', () => {
    expect(applySubOrderEvent('disputed', 'dispute_resolved_for_buyer', 'admin')).toEqual({
      changed: true,
      from: 'disputed',
      to: 'refunded',
    });
    expect(applySubOrderEvent('disputed', 'dispute_resolved_for_vendor', 'admin')).toEqual({
      changed: true,
      from: 'disputed',
      to: 'completed',
    });
  });

  it('holds settlement while contested', () => {
    expect(isSettlementHeld('disputed')).toBe(true);
    expect(isSettlementHeld('completed')).toBe(false);
  });
});

describe('settlement and stock predicates', () => {
  it('makes settlement eligible at completion, not at delivery', () => {
    expect(isSettlementEligible('completed')).toBe(true);
    expect(isSettlementEligible('delivered')).toBe(false);
  });

  it('releases reserved stock only when the sub-order is cancelled or refunded', () => {
    expect(shouldReleaseStock('cancelled')).toBe(true);
    expect(shouldReleaseStock('refunded')).toBe(true);
    expect(shouldReleaseStock('delivered')).toBe(false);
    expect(shouldReleaseStock('awaiting_payment')).toBe(false);
  });

  it('gates the buyer actions the order screen offers', () => {
    expect(canBuyerConfirmReceipt('delivered')).toBe(true);
    expect(canBuyerConfirmReceipt('in_transit')).toBe(false);
    expect(canBuyerDispute('delivered')).toBe(true);
    expect(canBuyerDispute('completed')).toBe(true);
    expect(canBuyerDispute('preparing')).toBe(false);
  });
});

describe('rollupOrderStatus()', () => {
  it('reports a single-vendor order plainly', () => {
    expect(rollupOrderStatus(['delivered'])).toBe('delivered');
    expect(rollupOrderStatus(['confirmed'])).toBe('confirmed');
  });

  it('reports partial progress when vendors are out of step', () => {
    expect(rollupOrderStatus(['delivered', 'preparing'])).toBe('partially_delivered');
    expect(rollupOrderStatus(['shipped', 'preparing'])).toBe('partially_shipped');
  });

  it('only reports delivered when every live sub-order has arrived', () => {
    expect(rollupOrderStatus(['delivered', 'delivered'])).toBe('delivered');
    expect(rollupOrderStatus(['delivered', 'completed'])).toBe('delivered');
    expect(rollupOrderStatus(['delivered', 'in_transit'])).toBe('partially_delivered');
  });

  it('reports completed only when all are completed', () => {
    expect(rollupOrderStatus(['completed', 'completed'])).toBe('completed');
    expect(rollupOrderStatus(['completed', 'delivered'])).toBe('delivered');
  });

  it('lets a dispute outrank everything — it is what the buyer needs to see', () => {
    expect(rollupOrderStatus(['disputed', 'completed'])).toBe('disputed');
    expect(rollupOrderStatus(['delivered', 'disputed'])).toBe('disputed');
  });

  it('does not let a cancelled half hold the order back', () => {
    // The classic bug: one vendor declines, and the order sits at "confirmed" forever while
    // the other parcel is genuinely in transit.
    expect(rollupOrderStatus(['cancelled', 'in_transit'])).toBe('shipped');
    expect(rollupOrderStatus(['cancelled', 'delivered'])).toBe('delivered');
  });

  it('reports cancelled only when nothing survives', () => {
    expect(rollupOrderStatus(['cancelled', 'cancelled'])).toBe('cancelled');
    expect(rollupOrderStatus(['cancelled', 'refunded'])).toBe('cancelled');
  });

  it('surfaces an unpaid sub-order above shipment progress', () => {
    expect(rollupOrderStatus(['awaiting_payment', 'confirmed'])).toBe('awaiting_payment');
  });

  it('handles an empty list without throwing', () => {
    expect(rollupOrderStatus([])).toBe('awaiting_payment');
  });

  it('returns a declared rollup status for every combination of two sub-orders', () => {
    for (const a of SUB_ORDER_STATUSES) {
      for (const b of SUB_ORDER_STATUSES) {
        expect(() => rollupOrderStatus([a, b] as SubOrderStatus[])).not.toThrow();
      }
    }
  });
});

describe('structural invariants', () => {
  it('defines a transition row for every status', () => {
    for (const status of SUB_ORDER_STATUSES) {
      expect(SUB_ORDER_TRANSITIONS[status]).toBeDefined();
    }
  });

  it('only ever targets a declared status, and never itself', () => {
    const known = new Set<string>(SUB_ORDER_STATUSES);
    for (const status of SUB_ORDER_STATUSES) {
      for (const target of Object.values(SUB_ORDER_TRANSITIONS[status])) {
        expect(known.has(target as string)).toBe(true);
        expect(target).not.toBe(status);
      }
    }
  });

  it('leaves terminal states with no outbound transitions', () => {
    expect(Object.keys(SUB_ORDER_TRANSITIONS.cancelled)).toHaveLength(0);
    expect(Object.keys(SUB_ORDER_TRANSITIONS.refunded)).toHaveLength(0);
  });
});

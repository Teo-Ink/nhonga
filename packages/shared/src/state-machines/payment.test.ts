import { describe, expect, it } from 'vitest';
import {
  applyPaymentEvent,
  canRefund,
  canRetryPayment,
  isPaymentPending,
  isPaymentSettled,
  isPaymentTerminal,
  PAYMENT_EVENT_TYPES,
  PAYMENT_STATUSES,
  PAYMENT_TRANSITIONS,
  requiresReconciliation,
  type PaymentStatus,
} from './payment.js';

describe('the happy path', () => {
  it('walks initiated → awaiting_user → paid', () => {
    let status: PaymentStatus = 'initiated';

    const accepted = applyPaymentEvent(status, 'provider_accepted');
    expect(accepted).toEqual({ changed: true, from: 'initiated', to: 'awaiting_user' });
    status = 'awaiting_user';

    const paid = applyPaymentEvent(status, 'confirmed_paid');
    expect(paid).toEqual({ changed: true, from: 'awaiting_user', to: 'paid' });
  });
});

describe('duplicate delivery is inert, not an error', () => {
  it('treats a repeated confirmed_paid at paid as already applied', () => {
    const result = applyPaymentEvent('paid', 'confirmed_paid');
    expect(result).toEqual({ changed: false, from: 'paid', reason: 'already_applied' });
  });

  it('treats a repeated confirmed_failed at failed as already applied', () => {
    const result = applyPaymentEvent('failed', 'confirmed_failed');
    expect(result).toEqual({ changed: false, from: 'failed', reason: 'already_applied' });
  });

  it('treats a repeated provider_accepted at awaiting_user as already applied', () => {
    const result = applyPaymentEvent('awaiting_user', 'provider_accepted');
    expect(result).toEqual({ changed: false, from: 'awaiting_user', reason: 'already_applied' });
  });

  it('is idempotent across three deliveries of the same callback', () => {
    // The mock provider's +258840000007 case, and a real occurrence.
    const first = applyPaymentEvent('awaiting_user', 'confirmed_paid');
    expect(first.changed).toBe(true);

    const second = applyPaymentEvent('paid', 'confirmed_paid');
    const third = applyPaymentEvent('paid', 'confirmed_paid');
    expect(second.changed).toBe(false);
    expect(third.changed).toBe(false);
  });
});

describe('expiry is not failure', () => {
  it('moves awaiting_user to expired when the window elapses', () => {
    expect(applyPaymentEvent('awaiting_user', 'expired')).toEqual({
      changed: true,
      from: 'awaiting_user',
      to: 'expired',
    });
  });

  it('honours a late confirmation — the transition that protects a debited buyer', () => {
    // Buyer approved on the handset after our 3-minute window closed. The money left their
    // wallet. Without this, they are a debited customer with no order.
    expect(applyPaymentEvent('expired', 'confirmed_paid')).toEqual({
      changed: true,
      from: 'expired',
      to: 'paid',
    });
  });

  it('accepts a late definitive failure too', () => {
    expect(applyPaymentEvent('expired', 'confirmed_failed')).toEqual({
      changed: true,
      from: 'expired',
      to: 'failed',
    });
  });

  it('does not treat expired as terminal', () => {
    expect(isPaymentTerminal('expired')).toBe(false);
  });

  it('keeps reconciling an expired payment', () => {
    expect(requiresReconciliation('expired')).toBe(true);
  });
});

describe('illegal transitions', () => {
  it('refuses to settle a payment the provider never accepted', () => {
    expect(applyPaymentEvent('initiated', 'confirmed_paid')).toEqual({
      changed: false,
      from: 'initiated',
      reason: 'illegal_transition',
    });
  });

  it('refuses a refund event against an unsettled payment', () => {
    expect(applyPaymentEvent('awaiting_user', 'refund_succeeded')).toEqual({
      changed: false,
      from: 'awaiting_user',
      reason: 'illegal_transition',
    });
  });

  it('reports terminal when the state can accept nothing at all', () => {
    expect(applyPaymentEvent('refunded', 'provider_accepted')).toEqual({
      changed: false,
      from: 'refunded',
      reason: 'terminal',
    });
  });

  it('never throws, for any status and event combination', () => {
    for (const status of PAYMENT_STATUSES) {
      for (const eventType of PAYMENT_EVENT_TYPES) {
        expect(() => applyPaymentEvent(status, eventType)).not.toThrow();
      }
    }
  });
});

describe('refunds', () => {
  it('walks paid → refund_pending → refunded', () => {
    expect(applyPaymentEvent('paid', 'refund_requested')).toEqual({
      changed: true,
      from: 'paid',
      to: 'refund_pending',
    });
    expect(applyPaymentEvent('refund_pending', 'refund_succeeded')).toEqual({
      changed: true,
      from: 'refund_pending',
      to: 'refunded',
    });
  });

  it('routes a rejected refund to a state operations can retry from', () => {
    expect(applyPaymentEvent('refund_pending', 'refund_rejected')).toEqual({
      changed: true,
      from: 'refund_pending',
      to: 'refund_failed',
    });
    expect(applyPaymentEvent('refund_failed', 'refund_requested')).toEqual({
      changed: true,
      from: 'refund_failed',
      to: 'refund_pending',
    });
  });

  it('permits refunds only from settled or refund-failed states', () => {
    expect(canRefund('paid')).toBe(true);
    expect(canRefund('refund_failed')).toBe(true);
    expect(canRefund('awaiting_user')).toBe(false);
    expect(canRefund('failed')).toBe(false);
    expect(canRefund('refunded')).toBe(false);
  });
});

describe('predicates used by the clients', () => {
  it('reports settlement only for paid', () => {
    expect(isPaymentSettled('paid')).toBe(true);
    for (const status of PAYMENT_STATUSES) {
      if (status !== 'paid') expect(isPaymentSettled(status)).toBe(false);
    }
  });

  it('reports pending while the buyer is at their handset', () => {
    expect(isPaymentPending('initiated')).toBe(true);
    expect(isPaymentPending('awaiting_user')).toBe(true);
    expect(isPaymentPending('expired')).toBe(false);
    expect(isPaymentPending('paid')).toBe(false);
  });

  it('allows a retry only after a resolved non-success', () => {
    expect(canRetryPayment('failed')).toBe(true);
    expect(canRetryPayment('expired')).toBe(true);
    expect(canRetryPayment('paid')).toBe(false);
    expect(canRetryPayment('awaiting_user')).toBe(false);
  });

  it('stops reconciling once a payment has resolved', () => {
    expect(requiresReconciliation('paid')).toBe(false);
    expect(requiresReconciliation('failed')).toBe(false);
    expect(requiresReconciliation('refunded')).toBe(false);
  });
});

describe('structural invariants', () => {
  it('defines a transition row for every status', () => {
    for (const status of PAYMENT_STATUSES) {
      expect(PAYMENT_TRANSITIONS[status]).toBeDefined();
    }
  });

  it('only ever targets a declared status', () => {
    const known = new Set<string>(PAYMENT_STATUSES);
    for (const status of PAYMENT_STATUSES) {
      for (const target of Object.values(PAYMENT_TRANSITIONS[status])) {
        expect(known.has(target as string)).toBe(true);
      }
    }
  });

  it('has no self-transitions — a state never re-enters itself', () => {
    for (const status of PAYMENT_STATUSES) {
      for (const target of Object.values(PAYMENT_TRANSITIONS[status])) {
        expect(target).not.toBe(status);
      }
    }
  });

  it('leaves paid reachable from every pending state', () => {
    expect(applyPaymentEvent('awaiting_user', 'confirmed_paid').changed).toBe(true);
    expect(applyPaymentEvent('expired', 'confirmed_paid').changed).toBe(true);
  });

  it('makes every status reachable from initiated', () => {
    const reachable = new Set<PaymentStatus>(['initiated']);
    let grew = true;
    while (grew) {
      grew = false;
      for (const status of Array.from(reachable)) {
        for (const target of Object.values(PAYMENT_TRANSITIONS[status])) {
          const next = target as PaymentStatus;
          if (!reachable.has(next)) {
            reachable.add(next);
            grew = true;
          }
        }
      }
    }
    for (const status of PAYMENT_STATUSES) {
      expect(reachable.has(status)).toBe(true);
    }
  });
});

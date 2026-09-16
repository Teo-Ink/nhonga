import { describe, expect, it } from 'vitest';
import { cents, formatMZN } from '../money.js';
import {
  computeCartTotals,
  computeSettlement,
  distributeDiscount,
  PricingError,
  sumSettlements,
  type CartLine,
} from './cart.js';

/** The cart from the Phase 1 key-screen mockup, so the numbers on screen are the tested ones. */
const MOCKUP_CART: CartLine[] = [
  { lineId: 'l1', vendorId: 'loja-cristal', unitPriceCents: cents(125000), quantity: 1 },
  { lineId: 'l2', vendorId: 'loja-cristal', unitPriceCents: cents(35000), quantity: 2 },
  { lineId: 'l3', vendorId: 'nelia-moda', unitPriceCents: cents(85000), quantity: 1 },
];

const MOCKUP_SHIPPING = [
  { vendorId: 'loja-cristal', feeCents: cents(15000) },
  { vendorId: 'nelia-moda', feeCents: cents(10000) },
];

describe('computeCartTotals()', () => {
  it('reproduces the mockup cart exactly', () => {
    const totals = computeCartTotals(MOCKUP_CART, MOCKUP_SHIPPING);

    expect(totals.itemsTotalCents).toBe(280000); // 1.250 + 700 + 850
    expect(totals.shippingTotalCents).toBe(25000);
    expect(totals.grandTotalCents).toBe(305000);
    expect(formatMZN(totals.grandTotalCents)).toBe('3.050,00 MT');
  });

  it('counts parcels, not line items — this is what the buyer is told', () => {
    const totals = computeCartTotals(MOCKUP_CART, MOCKUP_SHIPPING);
    expect(totals.vendorCount).toBe(2);
    expect(totals.itemCount).toBe(4);
  });

  it('groups by vendor with per-group subtotals', () => {
    const totals = computeCartTotals(MOCKUP_CART, MOCKUP_SHIPPING);
    expect(totals.groups).toHaveLength(2);

    const cristal = totals.groups[0];
    expect(cristal?.vendorId).toBe('loja-cristal');
    expect(cristal?.itemsTotalCents).toBe(195000);
    expect(cristal?.shippingCents).toBe(15000);
    expect(cristal?.groupTotalCents).toBe(210000);
    expect(cristal?.lineIds).toEqual(['l1', 'l2']);

    const nelia = totals.groups[1];
    expect(nelia?.itemsTotalCents).toBe(85000);
    expect(nelia?.groupTotalCents).toBe(95000);
  });

  it('keeps vendors in first-appearance order so the cart does not reshuffle', () => {
    const reordered: CartLine[] = [
      { lineId: 'a', vendorId: 'v2', unitPriceCents: cents(100), quantity: 1 },
      { lineId: 'b', vendorId: 'v1', unitPriceCents: cents(100), quantity: 1 },
      { lineId: 'c', vendorId: 'v2', unitPriceCents: cents(100), quantity: 1 },
    ];
    const totals = computeCartTotals(reordered);
    expect(totals.groups.map((g) => g.vendorId)).toEqual(['v2', 'v1']);
  });

  it('treats a missing shipping entry as free rather than throwing', () => {
    const totals = computeCartTotals(MOCKUP_CART);
    expect(totals.shippingTotalCents).toBe(0);
    expect(totals.grandTotalCents).toBe(280000);
  });

  it('applies a payment fee and a discount', () => {
    const totals = computeCartTotals(MOCKUP_CART, MOCKUP_SHIPPING, {
      paymentFeeCents: cents(5000),
      discountCents: cents(10000),
    });
    expect(totals.grandTotalCents).toBe(300000); // 305.000 + 5.000 − 10.000
  });

  it('satisfies the totals identity the database also enforces', () => {
    // Mirrors the totals_balance CHECK constraint in the order table.
    const totals = computeCartTotals(MOCKUP_CART, MOCKUP_SHIPPING, {
      paymentFeeCents: cents(5000),
      discountCents: cents(1234),
    });
    expect(totals.grandTotalCents).toBe(
      totals.itemsTotalCents +
        totals.shippingTotalCents +
        totals.paymentFeeCents -
        totals.discountCents,
    );
  });

  it('handles an empty cart', () => {
    const totals = computeCartTotals([]);
    expect(totals.grandTotalCents).toBe(0);
    expect(totals.vendorCount).toBe(0);
    expect(totals.groups).toEqual([]);
  });

  it('rejects inputs that should never reach pricing', () => {
    expect(() =>
      computeCartTotals([{ lineId: 'x', vendorId: 'v', unitPriceCents: cents(100), quantity: 0 }]),
    ).toThrow(PricingError);

    expect(() =>
      computeCartTotals([{ lineId: 'x', vendorId: 'v', unitPriceCents: cents(-1), quantity: 1 }]),
    ).toThrow(PricingError);

    expect(() =>
      computeCartTotals(MOCKUP_CART, [
        { vendorId: 'loja-cristal', feeCents: cents(100) },
        { vendorId: 'loja-cristal', feeCents: cents(200) },
      ]),
    ).toThrow(PricingError);

    expect(() =>
      computeCartTotals(MOCKUP_CART, MOCKUP_SHIPPING, { discountCents: cents(999999) }),
    ).toThrow(PricingError);
  });
});

describe('distributeDiscount()', () => {
  it('splits proportionally and loses nothing', () => {
    const shares = distributeDiscount(cents(10000), MOCKUP_CART);
    const sum = Array.from(shares.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(10000);
  });

  it('gives the largest share to the most valuable line', () => {
    const shares = distributeDiscount(cents(10000), MOCKUP_CART);
    expect(shares.get('l1')).toBeGreaterThan(shares.get('l3') as number);
  });

  it('survives an indivisible discount without drift', () => {
    // 100 centavos across three lines of equal value.
    const equal: CartLine[] = [
      { lineId: 'a', vendorId: 'v', unitPriceCents: cents(1000), quantity: 1 },
      { lineId: 'b', vendorId: 'v', unitPriceCents: cents(1000), quantity: 1 },
      { lineId: 'c', vendorId: 'v', unitPriceCents: cents(1000), quantity: 1 },
    ];
    const shares = distributeDiscount(cents(100), equal);
    const sum = Array.from(shares.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
    expect(Array.from(shares.values()).sort()).toEqual([33, 33, 34]);
  });

  it('returns zeros for a zero discount', () => {
    const shares = distributeDiscount(cents(0), MOCKUP_CART);
    expect(Array.from(shares.values())).toEqual([0, 0, 0]);
  });

  it('handles an empty cart', () => {
    expect(distributeDiscount(cents(100), []).size).toBe(0);
  });
});

describe('computeSettlement()', () => {
  const rule = { percentageBps: 800, fixedFeeCents: cents(1000) };

  it('reproduces the vendor finance screen from the mockup', () => {
    // Loja Cristal's sub-order: 1.950,00 gross, 8% commission, 10,00 fixed fee.
    const breakdown = computeSettlement({ grossCents: cents(195000), rule });

    expect(breakdown.commissionCents).toBe(15600);
    expect(breakdown.fixedFeeCents).toBe(1000);
    expect(breakdown.netCents).toBe(178400);
    expect(formatMZN(breakdown.netCents)).toBe('1.784,00 MT');
    expect(breakdown.clamped).toBe(false);
  });

  it('itemises every deduction separately for the vendor finance screen', () => {
    const breakdown = computeSettlement({ grossCents: cents(195000), rule });
    expect(
      breakdown.grossCents -
        breakdown.commissionCents -
        breakdown.fixedFeeCents +
        breakdown.adjustmentCents,
    ).toBe(breakdown.netCents);
  });

  it('applies a negative adjustment for a partial refund', () => {
    const breakdown = computeSettlement({
      grossCents: cents(195000),
      rule,
      adjustmentCents: cents(-5000),
    });
    expect(breakdown.netCents).toBe(173400);
  });

  it('never bills a vendor for making a sale, and flags when it had to clamp', () => {
    // A 10,00 MT fixed fee against a 5,00 MT order.
    const breakdown = computeSettlement({ grossCents: cents(500), rule });
    expect(breakdown.netCents).toBe(0);
    expect(breakdown.clamped).toBe(true);
    expect(breakdown.commissionCents).toBe(40); // 8% of 5,00
    expect(breakdown.fixedFeeCents).toBe(460); // reduced from 1000
  });

  it('handles a zero-commission rule', () => {
    const breakdown = computeSettlement({
      grossCents: cents(195000),
      rule: { percentageBps: 0, fixedFeeCents: cents(0) },
    });
    expect(breakdown.netCents).toBe(195000);
  });

  it('applies category-tiered rates as configured', () => {
    // Electronics 5% vs fashion 12% — the reason the model is tiered (D-17).
    const electronics = computeSettlement({
      grossCents: cents(100000),
      rule: { percentageBps: 500, fixedFeeCents: cents(0) },
    });
    const fashion = computeSettlement({
      grossCents: cents(100000),
      rule: { percentageBps: 1200, fixedFeeCents: cents(0) },
    });
    expect(electronics.commissionCents).toBe(5000);
    expect(fashion.commissionCents).toBe(12000);
  });

  it('rejects a negative gross', () => {
    expect(() => computeSettlement({ grossCents: cents(-1), rule })).toThrow(PricingError);
  });
});

describe('sumSettlements()', () => {
  it('totals a payout batch', () => {
    const rule = { percentageBps: 800, fixedFeeCents: cents(1000) };
    const batch = [
      computeSettlement({ grossCents: cents(195000), rule }),
      computeSettlement({ grossCents: cents(85000), rule }),
    ];
    expect(sumSettlements(batch)).toBe(178400 + 77200);
  });

  it('returns zero for an empty batch', () => {
    expect(sumSettlements([])).toBe(0);
  });
});

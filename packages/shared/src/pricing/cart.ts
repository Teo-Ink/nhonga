/**
 * Cart and settlement arithmetic.
 *
 * Shared verbatim between the API, the web app, and the mobile app. The API's figure is always
 * authoritative — the clients compute the same totals only so the cart stays responsive while
 * offline (D-12). Because both sides run this code, a mismatch means a bug rather than a
 * rounding difference, which is exactly the property we want when the number is a price.
 */

import {
  add,
  allocate,
  applyBasisPoints,
  cents,
  multiply,
  subtract,
  ZERO,
  type Cents,
} from '../money.js';

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cart totals
// ─────────────────────────────────────────────────────────────────────────────

export interface CartLine {
  readonly lineId: string;
  readonly vendorId: string;
  readonly unitPriceCents: Cents;
  readonly quantity: number;
}

export interface VendorShipping {
  readonly vendorId: string;
  readonly feeCents: Cents;
}

export interface VendorGroupTotals {
  readonly vendorId: string;
  readonly lineIds: readonly string[];
  readonly itemCount: number;
  readonly itemsTotalCents: Cents;
  readonly shippingCents: Cents;
  readonly groupTotalCents: Cents;
}

export interface CartTotals {
  readonly groups: readonly VendorGroupTotals[];
  readonly itemCount: number;
  /** Rendered to the buyer as "N entregas" — parcels, not line items. See key screens §4. */
  readonly vendorCount: number;
  readonly itemsTotalCents: Cents;
  readonly shippingTotalCents: Cents;
  readonly paymentFeeCents: Cents;
  readonly discountCents: Cents;
  readonly grandTotalCents: Cents;
}

export interface CartTotalsOptions {
  /** Mobile-money transaction fee, if the platform passes it on. Policy is OQ-5; the field
   *  exists from day one either way so the policy can change without a migration. */
  readonly paymentFeeCents?: Cents;
  readonly discountCents?: Cents;
}

/**
 * Group a cart by vendor and total it.
 *
 * Grouping happens here rather than at checkout because the multi-vendor reality has to be
 * legible while the buyer can still act on it. Learning at the payment screen that four items
 * are three shipments with three delivery fees is a trust failure at the worst moment (D-11).
 *
 * Vendor order is the order of first appearance in `lines`, so the cart does not reshuffle
 * under the buyer when they change a quantity.
 */
export function computeCartTotals(
  lines: readonly CartLine[],
  shipping: readonly VendorShipping[] = [],
  options: CartTotalsOptions = {},
): CartTotals {
  const shippingByVendor = new Map<string, Cents>();
  for (const entry of shipping) {
    if (shippingByVendor.has(entry.vendorId)) {
      throw new PricingError(`Duplicate shipping entry for vendor ${entry.vendorId}`);
    }
    if (entry.feeCents < 0) {
      throw new PricingError(`Shipping fee cannot be negative for vendor ${entry.vendorId}`);
    }
    shippingByVendor.set(entry.vendorId, entry.feeCents);
  }

  const order: string[] = [];
  const byVendor = new Map<string, { lineIds: string[]; itemCount: number; itemsTotal: Cents }>();

  for (const line of lines) {
    if (line.quantity <= 0) {
      throw new PricingError(`Line ${line.lineId} has a non-positive quantity`);
    }
    if (line.unitPriceCents < 0) {
      throw new PricingError(`Line ${line.lineId} has a negative unit price`);
    }

    let group = byVendor.get(line.vendorId);
    if (group === undefined) {
      group = { lineIds: [], itemCount: 0, itemsTotal: ZERO };
      byVendor.set(line.vendorId, group);
      order.push(line.vendorId);
    }

    group.lineIds.push(line.lineId);
    group.itemCount += line.quantity;
    group.itemsTotal = add(group.itemsTotal, multiply(line.unitPriceCents, line.quantity));
  }

  const groups: VendorGroupTotals[] = [];
  let itemsTotal = ZERO;
  let shippingTotal = ZERO;
  let itemCount = 0;

  for (const vendorId of order) {
    const group = byVendor.get(vendorId);
    if (group === undefined) continue;

    const shippingCents = shippingByVendor.get(vendorId) ?? ZERO;
    groups.push({
      vendorId,
      lineIds: group.lineIds,
      itemCount: group.itemCount,
      itemsTotalCents: group.itemsTotal,
      shippingCents,
      groupTotalCents: add(group.itemsTotal, shippingCents),
    });

    itemsTotal = add(itemsTotal, group.itemsTotal);
    shippingTotal = add(shippingTotal, shippingCents);
    itemCount += group.itemCount;
  }

  const paymentFeeCents = options.paymentFeeCents ?? ZERO;
  const discountCents = options.discountCents ?? ZERO;

  if (paymentFeeCents < 0) throw new PricingError('Payment fee cannot be negative');
  if (discountCents < 0) throw new PricingError('Discount cannot be negative');

  const beforeDiscount = add(itemsTotal, shippingTotal, paymentFeeCents);
  if (discountCents > beforeDiscount) {
    throw new PricingError('Discount exceeds the order total');
  }

  return {
    groups,
    itemCount,
    vendorCount: groups.length,
    itemsTotalCents: itemsTotal,
    shippingTotalCents: shippingTotal,
    paymentFeeCents,
    discountCents,
    grandTotalCents: subtract(beforeDiscount, discountCents),
  };
}

/**
 * Distribute an order-level discount across lines proportionally to their value.
 *
 * Needed because a discount applied at the order level still has to be attributed per line for
 * refunds, per-vendor settlement, and partial cancellation. Uses largest-remainder allocation,
 * so the parts sum to the discount exactly — no stray centavo appears or disappears when a
 * single line is later refunded.
 */
export function distributeDiscount(
  discountCents: Cents,
  lines: readonly CartLine[],
): Map<string, Cents> {
  const result = new Map<string, Cents>();
  if (lines.length === 0) return result;

  if (discountCents === 0) {
    for (const line of lines) result.set(line.lineId, ZERO);
    return result;
  }

  const weights = lines.map((line) => line.unitPriceCents * line.quantity);
  const shares = allocate(discountCents, weights);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) continue;
    result.set(line.lineId, shares[i] ?? ZERO);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Settlement
// ─────────────────────────────────────────────────────────────────────────────

export interface CommissionRule {
  /** Basis points. 8% is 800, 8.25% is 825. Integers only — see D-17. */
  readonly percentageBps: number;
  readonly fixedFeeCents: Cents;
}

export interface SettlementInput {
  /** Items total for this sub-order. Shipping is excluded — see the note below. */
  readonly grossCents: Cents;
  readonly rule: CommissionRule;
  /** Refunds, goodwill credits, or manual corrections. May be negative. */
  readonly adjustmentCents?: Cents;
}

export interface SettlementBreakdown {
  readonly grossCents: Cents;
  readonly commissionCents: Cents;
  readonly fixedFeeCents: Cents;
  readonly adjustmentCents: Cents;
  readonly netCents: Cents;
  /**
   * True when fees would have exceeded the gross and were reduced so the vendor is not billed
   * for selling. Surfaced rather than swallowed: a clamped settlement means the fee
   * configuration is wrong for low-value orders in that category, and someone should know.
   */
  readonly clamped: boolean;
}

/**
 * Compute what a vendor is paid for one completed sub-order.
 *
 * **Commission applies to the items total, not to shipping.** Charging a percentage on a
 * delivery fee the vendor collects and hands to a courier means billing them for someone else's
 * revenue — a small amount of money and a large amount of vendor ill-will, which we cannot
 * afford while recruiting supply.
 *
 * Every deduction is returned separately so the vendor's finance screen can itemise it.
 * Opaque deductions are the fastest way to lose vendors.
 */
export function computeSettlement(input: SettlementInput): SettlementBreakdown {
  const { grossCents, rule } = input;
  const adjustmentCents = input.adjustmentCents ?? ZERO;

  if (grossCents < 0) {
    throw new PricingError('Settlement gross cannot be negative');
  }
  if (rule.fixedFeeCents < 0) {
    throw new PricingError('Fixed fee cannot be negative');
  }

  const commissionCents = applyBasisPoints(grossCents, rule.percentageBps);

  let fixedFeeCents = rule.fixedFeeCents;
  let clamped = false;

  // A 10,00 MT fixed fee against a 5,00 MT order would bill the vendor for making a sale.
  const totalFees = commissionCents + fixedFeeCents;
  if (totalFees > grossCents) {
    fixedFeeCents = cents(Math.max(0, grossCents - commissionCents));
    clamped = true;
  }

  const netCents = cents(grossCents - commissionCents - fixedFeeCents + adjustmentCents);

  return {
    grossCents,
    commissionCents,
    fixedFeeCents,
    adjustmentCents,
    netCents,
    clamped,
  };
}

/** Sum a set of settlement rows into a payout batch figure for one vendor. */
export function sumSettlements(breakdowns: readonly SettlementBreakdown[]): Cents {
  let total = ZERO;
  for (const breakdown of breakdowns) {
    total = add(total, breakdown.netCents);
  }
  return total;
}

/**
 * Orders, payments, and settlements — the money path.
 *
 * `order` is the buyer's payment unit; `sub_order` is the vendor's fulfilment and settlement
 * unit (D-11). There is deliberately **no `order.status` column**: a two-vendor order has no
 * single truthful status, and a stored rollup would drift out of sync with its children, showing
 * up as a lie in the buyer's timeline. The rollup is computed by `rollupOrderStatus()` in
 * `@nhonga/shared`.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { address, appUser } from './identity.js';
import { productVariant } from './catalog.js';
import { commissionRule, vendor } from './vendors.js';

const now = sql`now()`;

/** Frozen copy of an address as it was at purchase. Editing a saved address must not alter
 *  where a past order was shipped. */
export interface AddressSnapshot {
  readonly recipientName: string;
  readonly phoneE164: string;
  readonly provinceName: string;
  readonly districtName: string;
  readonly bairro: string;
  readonly quarteirao: string | null;
  readonly houseNumber: string | null;
  readonly landmark: string;
  readonly notes: string | null;
}

/** Frozen copy of a product line as it was at purchase. A vendor renaming, repricing, or
 *  deleting a product must not retroactively rewrite someone's receipt. */
export interface ProductSnapshot {
  readonly title: string;
  readonly optionsLabel: string;
  readonly imageUrl: string | null;
  readonly sku: string;
  readonly vendorDisplayName: string;
}

export const order = pgTable(
  'order',
  {
    id: uuid('id').primaryKey(),
    /** Human-facing, shown as #4821. Not sequential across the platform — a sequential number
     *  would leak our order volume to anyone who places two orders. */
    orderNumber: text('order_number').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id),
    addressId: uuid('address_id').references(() => address.id),
    addressSnapshot: jsonb('address_snapshot').$type<AddressSnapshot>().notNull(),

    itemsTotalCents: bigint('items_total_cents', { mode: 'number' }).notNull(),
    shippingTotalCents: bigint('shipping_total_cents', { mode: 'number' }).notNull(),
    /** Mobile-money transaction fee, if the platform passes it on (OQ-5). The column exists
     *  from day one either way, so the policy can change without a migration. */
    paymentFeeCents: bigint('payment_fee_cents', { mode: 'number' }).notNull().default(0),
    discountCents: bigint('discount_cents', { mode: 'number' }).notNull().default(0),
    grandTotalCents: bigint('grand_total_cents', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('MZN'),

    placedAt: timestamp('placed_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    uniqueIndex('order_number_key').on(table.orderNumber),
    index('order_user_idx').on(table.userId, table.placedAt.desc()),
    check('order_items_total_check', sql`${table.itemsTotalCents} >= 0`),
    check('order_shipping_total_check', sql`${table.shippingTotalCents} >= 0`),
    check('order_payment_fee_check', sql`${table.paymentFeeCents} >= 0`),
    check('order_discount_check', sql`${table.discountCents} >= 0`),
    check('order_grand_total_check', sql`${table.grandTotalCents} >= 0`),
    /**
     * Belt and braces: an order whose arithmetic does not add up cannot be written, whatever a
     * bug in the pricing code does. `computeCartTotals()` in @nhonga/shared enforces the same
     * identity, and its test asserts it — this is the layer that holds when that one is wrong.
     */
    check(
      'order_totals_balance_check',
      sql`${table.grandTotalCents} = ${table.itemsTotalCents} + ${table.shippingTotalCents} + ${table.paymentFeeCents} - ${table.discountCents}`,
    ),
  ],
);

export const subOrder = pgTable(
  'sub_order',
  {
    id: uuid('id').primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id),
    /** #4821-A */
    subOrderNumber: text('sub_order_number').notNull(),
    status: text('status').notNull().default('awaiting_payment'),

    itemsTotalCents: bigint('items_total_cents', { mode: 'number' }).notNull(),
    shippingCents: bigint('shipping_cents', { mode: 'number' }).notNull().default(0),

    deliveryMethod: text('delivery_method').notNull().default('marketplace'),
    trackingCode: text('tracking_code'),
    estimatedMinDays: smallint('estimated_min_days'),
    estimatedMaxDays: smallint('estimated_max_days'),

    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    /** deliveredAt + 7 days. Swept by a worker so vendor payouts are not stranded by ordinary
     *  buyer inattention. */
    autoCompleteAt: timestamp('auto_complete_at', { withTimezone: true }),
    /** Vendors have 24h to accept; silence auto-cancels, because an unanswered order is worse
     *  for buyer trust than a declined one. */
    respondByAt: timestamp('respond_by_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('sub_order_number_key').on(table.subOrderNumber),
    uniqueIndex('sub_order_order_vendor_key').on(table.orderId, table.vendorId),
    index('sub_order_vendor_status_idx').on(table.vendorId, table.status),
    index('sub_order_auto_complete_idx')
      .on(table.autoCompleteAt)
      .where(sql`${table.status} = 'delivered'`),
    index('sub_order_respond_by_idx')
      .on(table.respondByAt)
      .where(sql`${table.status} = 'confirmed'`),
    check(
      'sub_order_status_check',
      sql`${table.status} in ('awaiting_payment','confirmed','preparing','shipped','in_transit','delivered','completed','cancelled','disputed','refunded')`,
    ),
    check(
      'sub_order_delivery_method_check',
      sql`${table.deliveryMethod} in ('marketplace','vendor','pickup')`,
    ),
    check('sub_order_items_total_check', sql`${table.itemsTotalCents} >= 0`),
    check('sub_order_shipping_check', sql`${table.shippingCents} >= 0`),
  ],
);

export const orderItem = pgTable(
  'order_item',
  {
    id: uuid('id').primaryKey(),
    subOrderId: uuid('sub_order_id')
      .notNull()
      .references(() => subOrder.id),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariant.id),
    productSnapshot: jsonb('product_snapshot').$type<ProductSnapshot>().notNull(),
    unitPriceCents: bigint('unit_price_cents', { mode: 'number' }).notNull(),
    quantity: integer('quantity').notNull(),
    lineTotalCents: bigint('line_total_cents', { mode: 'number' }).notNull(),
    /** Share of any order-level discount attributed to this line, so partial refunds and
     *  per-vendor settlement stay exact. */
    discountCents: bigint('discount_cents', { mode: 'number' }).notNull().default(0),
  },
  (table) => [
    index('order_item_sub_order_idx').on(table.subOrderId),
    index('order_item_variant_idx').on(table.variantId),
    check('order_item_unit_price_check', sql`${table.unitPriceCents} >= 0`),
    check('order_item_quantity_check', sql`${table.quantity} > 0`),
    check(
      'order_item_line_total_check',
      sql`${table.lineTotalCents} = ${table.unitPriceCents} * ${table.quantity}`,
    ),
  ],
);

/** Append-only state log, one row per transition. Drives the buyer's timeline and the audit
 *  trail together. */
export const orderEvent = pgTable(
  'order_event',
  {
    id: uuid('id').primaryKey(),
    subOrderId: uuid('sub_order_id')
      .notNull()
      .references(() => subOrder.id),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    eventType: text('event_type').notNull(),
    actorType: text('actor_type').notNull(),
    actorId: uuid('actor_id'),
    reason: text('reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index('order_event_sub_order_idx').on(table.subOrderId, table.createdAt),
    check(
      'order_event_actor_check',
      sql`${table.actorType} in ('buyer','vendor','admin','system')`,
    ),
  ],
);

// ── Payments ─────────────────────────────────────────────────────────────────

export const payment = pgTable(
  'payment',
  {
    id: uuid('id').primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id),
    provider: text('provider').notNull(),
    /** Encrypted at rest — it links a person to a wallet transaction. */
    msisdnEncrypted: text('msisdn_encrypted'),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('MZN'),
    status: text('status').notNull().default('initiated'),

    /** Their reference. */
    providerTxId: text('provider_tx_id'),
    /** Ours, sent to them and echoed on the payer's SMS receipt. */
    providerRef: text('provider_ref').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),

    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    /** Each retry is a new row; this records which attempt it is for the same order. */
    attemptNumber: smallint('attempt_number').notNull().default(1),

    initiatedAt: timestamp('initiated_at', { withTimezone: true }).notNull().default(now),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Reconciliation keeps querying until this passes, even after expiry (D-23). */
    reconcileUntil: timestamp('reconcile_until', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('payment_idempotency_key').on(table.idempotencyKey),
    uniqueIndex('payment_provider_tx_key')
      .on(table.provider, table.providerTxId)
      .where(sql`${table.providerTxId} is not null`),
    index('payment_order_idx').on(table.orderId),
    /** The partial index the reconciliation sweep rides. Keeps "find every payment stuck
     *  awaiting the user" cheap no matter how large this table grows. */
    index('payment_awaiting_idx')
      .on(table.expiresAt)
      .where(sql`${table.status} in ('initiated','awaiting_user')`),
    index('payment_reconcile_idx')
      .on(table.reconcileUntil)
      .where(sql`${table.status} = 'expired'`),
    check('payment_provider_check', sql`${table.provider} in ('mpesa','emola','mkesh','cod')`),
    check(
      'payment_status_check',
      sql`${table.status} in ('initiated','awaiting_user','paid','failed','expired','refund_pending','refunded','refund_failed')`,
    ),
    check('payment_amount_check', sql`${table.amountCents} > 0`),
  ],
);

/**
 * Append-only log of every provider interaction: our request, their acknowledgement, each
 * webhook delivery, each status query.
 *
 * `payment.status` is a projection of this log, and this log is what we point at when a buyer
 * says they were debited. Nothing here is ever updated or deleted.
 *
 * The unique constraint on `(provider, providerEventId)` is what makes duplicate webhook
 * delivery a database no-op: the second insert violates it, we return 200, nothing changes.
 * That is a property of the schema rather than something application code must remember.
 */
export const paymentEvent = pgTable(
  'payment_event',
  {
    id: uuid('id').primaryKey(),
    paymentId: uuid('payment_id').references(() => payment.id),
    provider: text('provider').notNull(),
    providerEventId: text('provider_event_id'),
    direction: text('direction').notNull(),
    eventType: text('event_type').notNull(),
    /** Exactly what we sent or received. When something is disputed months later, the argument
     *  is settled by this, not by our interpretation of it. */
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>().notNull(),
    signatureValid: boolean('signature_valid'),
    /** Null until a worker has applied it to the payment state machine. */
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processingError: text('processing_error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    uniqueIndex('payment_event_provider_event_key')
      .on(table.provider, table.providerEventId)
      .where(sql`${table.providerEventId} is not null`),
    index('payment_event_payment_idx').on(table.paymentId, table.receivedAt),
    index('payment_event_unprocessed_idx')
      .on(table.receivedAt)
      .where(sql`${table.processedAt} is null`),
    check('payment_event_direction_check', sql`${table.direction} in ('outbound','inbound')`),
  ],
);

export const refund = pgTable(
  'refund',
  {
    id: uuid('id').primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payment.id),
    subOrderId: uuid('sub_order_id').references(() => subOrder.id),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('pending'),
    providerRefundId: text('provider_refund_id'),
    idempotencyKey: text('idempotency_key').notNull(),
    requestedBy: uuid('requested_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('refund_idempotency_key').on(table.idempotencyKey),
    index('refund_payment_idx').on(table.paymentId),
    check('refund_amount_check', sql`${table.amountCents} > 0`),
    check('refund_status_check', sql`${table.status} in ('pending','succeeded','failed')`),
  ],
);

// ── Settlements ──────────────────────────────────────────────────────────────

export const settlementBatch = pgTable(
  'settlement_batch',
  {
    id: uuid('id').primaryKey(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id),
    totalCents: bigint('total_cents', { mode: 'number' }).notNull(),
    status: text('status').notNull().default('draft'),
    /** Payouts require admin approval, with dual approval above a configurable threshold. An
     *  automated payout pipeline with no human gate is how a compromised admin empties the
     *  float. */
    approvedBy: uuid('approved_by'),
    secondApprovedBy: uuid('second_approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    providerTxId: text('provider_tx_id'),
    failureMessage: text('failure_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index('settlement_batch_vendor_idx').on(table.vendorId, table.createdAt.desc()),
    check(
      'settlement_batch_status_check',
      sql`${table.status} in ('draft','awaiting_approval','approved','paid','failed')`,
    ),
  ],
);

export const settlement = pgTable(
  'settlement',
  {
    id: uuid('id').primaryKey(),
    subOrderId: uuid('sub_order_id')
      .notNull()
      .references(() => subOrder.id),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id),
    batchId: uuid('batch_id').references(() => settlementBatch.id),

    grossCents: bigint('gross_cents', { mode: 'number' }).notNull(),
    commissionCents: bigint('commission_cents', { mode: 'number' }).notNull(),
    fixedFeeCents: bigint('fixed_fee_cents', { mode: 'number' }).notNull(),
    adjustmentCents: bigint('adjustment_cents', { mode: 'number' }).notNull().default(0),
    netCents: bigint('net_cents', { mode: 'number' }).notNull(),
    /** True when fees exceeded gross and were reduced. Surfaced rather than swallowed: it means
     *  the fee configuration is wrong for low-value orders in that category. */
    feesClamped: boolean('fees_clamped').notNull().default(false),

    status: text('status').notNull().default('pending'),
    heldReason: text('held_reason'),
    /** Which rule applied, so a question about a 2026 order is answerable in 2028. */
    commissionRuleId: uuid('commission_rule_id').references(() => commissionRule.id),

    eligibleAt: timestamp('eligible_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('settlement_sub_order_key').on(table.subOrderId),
    index('settlement_vendor_status_idx').on(table.vendorId, table.status),
    index('settlement_batch_idx').on(table.batchId),
    check(
      'settlement_status_check',
      sql`${table.status} in ('pending','eligible','held','batched','paid','failed')`,
    ),
    check(
      'settlement_balance_check',
      sql`${table.netCents} = ${table.grossCents} - ${table.commissionCents} - ${table.fixedFeeCents} + ${table.adjustmentCents}`,
    ),
  ],
);

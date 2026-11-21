/**
 * Hosted-checkout payment intents (mobile money via an aggregator).
 *
 * One row per attempt to collect money: we create it, send the buyer to the
 * gateway's hosted payment page, and settle it exactly once when the gateway
 * confirms. `status` only ever moves forward; the pending → paid transition is
 * a single conditional UPDATE, which is what makes webhook retries, the return
 * page and the reconciliation sweep safe to race each other.
 *
 * Applied by drizzle/0018_checkout_intent.sql (hand-written, idempotent).
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

const now = sql`now()`;

export const checkoutIntent = pgTable(
  'checkout_intent',
  {
    id: uuid('id').primaryKey(),
    /** What the money is for. Each purpose has one settlement handler. */
    purpose: text('purpose').notNull(),
    /** Who is paying (the seller's shop for wallet top-ups). */
    vendorId: uuid('vendor_id'),
    /** Purpose-specific details, e.g. { packageId } — never card or PIN data. */
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: text('currency').notNull().default('MZN'),
    /** Wallet the buyer chose: mpesa | emola | mkesh | card. */
    method: text('method').notNull(),
    /** Which aggregator handled it (pawapay | paysuite | mock). */
    gateway: text('gateway').notNull(),
    /** The gateway's own id for this payment (PawaPay depositId, PaySuite payment id). */
    gatewayRef: text('gateway_ref'),
    checkoutUrl: text('checkout_url'),
    status: text('status').notNull().default('pending'),
    /** Last failure reason reported by the gateway, for support. */
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (table) => [
    unique('checkout_intent_gateway_ref_unique').on(table.gateway, table.gatewayRef),
    index('checkout_intent_status_idx').on(table.status, table.createdAt),
    index('checkout_intent_vendor_idx').on(table.vendorId, table.createdAt),
    check(
      'checkout_intent_status_check',
      sql`${table.status} in ('pending','paid','failed','expired','review')`,
    ),
    check('checkout_intent_amount_check', sql`${table.amountCents} > 0`),
  ],
);

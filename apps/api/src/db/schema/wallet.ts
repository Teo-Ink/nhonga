/**
 * Seller wallet (monetisation). Mirrors the marketplace "balance + points"
 * model: a seller tops up a MZN balance and earns loyalty points, then spends
 * on listing packages / boosts. The wallet is keyed by vendor (one per shop).
 * Top-ups are demo credits in this build (no live payment gateway) but the
 * balance and the transaction history are real and persisted.
 */
import { sql } from 'drizzle-orm';
import { bigint, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { vendor } from './vendors.js';

const now = sql`now()`;

export const wallet = pgTable('wallet', {
  vendorId: uuid('vendor_id')
    .primaryKey()
    .references(() => vendor.id, { onDelete: 'cascade' }),
  balanceCents: bigint('balance_cents', { mode: 'number' }).notNull().default(0),
  points: integer('points').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
});

export const walletTransaction = pgTable(
  'wallet_transaction',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    /** 'topup' (balance added) | 'purchase' (package bought). */
    kind: text('kind').notNull(),
    /** Balance delta in cents: positive on top-up, negative when spent. */
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull().default(0),
    /** Points delta. */
    points: integer('points').notNull().default(0),
    description: text('description').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (t) => [index('wallet_tx_vendor_idx').on(t.vendorId, t.createdAt)],
);

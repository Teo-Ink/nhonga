/**
 * Paid visibility (E): admin-managed promotion plans, and the purchases that
 * apply them to a listing. Payment goes through the payments module.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { product } from './catalog.js';

const now = sql`now()`;

/** Admin-set pricing. `kind`: a "feature" plan sets featured_until; a "bump"
 *  plan updates bumped_at (Subir para o topo). Prices are edited here, not in
 *  code. */
export const promotionPlan = pgTable(
  'promotion_plan',
  {
    code: text('code').primaryKey(),
    namePt: text('name_pt').notNull(),
    nameEn: text('name_en').notNull(),
    kind: text('kind').notNull(),
    priceCents: bigint('price_cents', { mode: 'number' }).notNull(),
    durationDays: integer('duration_days').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    check('promotion_plan_kind_check', sql`${t.kind} in ('feature', 'bump')`),
    check('promotion_plan_price_check', sql`${t.priceCents} >= 0`),
  ],
);

/** A purchase of a promotion for one listing. Doubles as the receipt. */
export const productPromotion = pgTable(
  'product_promotion',
  {
    id: uuid('id').primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    planCode: text('plan_code').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    paymentMethod: text('payment_method').notNull(),
    status: text('status').notNull().default('pending'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (t) => [
    index('product_promotion_product_idx').on(t.productId),
    check('product_promotion_status_check', sql`${t.status} in ('pending', 'active', 'failed')`),
  ],
);

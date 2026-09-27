/**
 * Listing reports (trust & safety).
 *
 * Anyone can flag a listing they think is a scam, prohibited, spam, etc. Reports
 * are kept for ops review even if the listing is later removed (product_id is
 * set null; the slug is snapshotted). Reporting is anonymous by default.
 */

import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { product } from './catalog.js';
import { appUser } from './identity.js';

const now = sql`now()`;

export const listingReport = pgTable(
  'listing_report',
  {
    id: uuid('id').primaryKey(),
    productId: uuid('product_id').references(() => product.id, { onDelete: 'set null' }),
    /** Snapshot so the report stays meaningful if the listing is removed. */
    productSlug: text('product_slug').notNull(),
    /** Optional — set when a signed-in user reports. */
    reporterUserId: uuid('reporter_user_id').references(() => appUser.id, { onDelete: 'set null' }),
    reason: text('reason').notNull(),
    note: text('note'),
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index('listing_report_status_idx').on(table.status),
    index('listing_report_product_idx').on(table.productId),
    check(
      'listing_report_reason_check',
      sql`${table.reason} in ('fraud','prohibited','spam','wrong_category','offensive','other')`,
    ),
    check('listing_report_status_check', sql`${table.status} in ('open','reviewed','dismissed')`),
  ],
);

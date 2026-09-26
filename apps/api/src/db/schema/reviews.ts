/**
 * Seller reviews.
 *
 * In the classifieds model there is no order to attach a review to, so a review is left against a
 * vendor (optionally referencing the listing that prompted the contact). The author is an
 * authenticated app_user, and a user may leave at most one review per vendor (repeat submissions
 * edit it). Published reviews drive the denormalised `vendor.rating_avg` / `rating_count`.
 */

import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { appUser } from './identity.js';
import { vendor } from './vendors.js';
import { product } from './catalog.js';

const now = sql`now()`;

export const review = pgTable(
  'review',
  {
    id: uuid('id').primaryKey(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    /** The listing that prompted the contact, if any. Kept if the listing is later removed. */
    productId: uuid('product_id').references(() => product.id, { onDelete: 'set null' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    /** Snapshot of the author's display name at review time. */
    authorName: text('author_name').notNull(),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    status: text('status').notNull().default('published'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index('review_vendor_idx').on(table.vendorId),
    // One review per author per vendor — a repeat POST edits the existing one.
    uniqueIndex('review_vendor_author_key').on(table.vendorId, table.authorUserId),
    check('review_rating_check', sql`${table.rating} >= 1 and ${table.rating} <= 5`),
    check('review_status_check', sql`${table.status} in ('published','hidden')`),
  ],
);

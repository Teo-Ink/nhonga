/**
 * Server-side favourites (J). The heart stays instant via localStorage; for a
 * signed-in user it also syncs here, which powers cross-device favourites and
 * price-drop alerts. We snapshot the price at save time so we can tell when a
 * seller later lowers it.
 */
import { sql } from 'drizzle-orm';
import { bigint, index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { appUser } from './identity.js';
import { product } from './catalog.js';

const now = sql`now()`;

export const favorite = pgTable(
  'favorite',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    /** Price (cents) when the user saved it — the baseline for price-drop alerts. */
    savedPriceCents: bigint('saved_price_cents', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.productId] }),
    index('favorite_product_idx').on(t.productId),
  ],
);

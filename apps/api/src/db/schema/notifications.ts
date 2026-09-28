/**
 * Seller notifications (H): a new contact on a listing, or a new review on the
 * shop. Written by the catalogue/reviews modules, read by the notifications
 * endpoint. Kept deliberately simple (no channels/preferences).
 */
import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { appUser } from './identity.js';

const now = sql`now()`;

export const notification = pgTable(
  'notification',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    /** 'contact' | 'review' */
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    /** In-app link to open (e.g. /produto/<slug> or /loja/<slug>). */
    href: text('href'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (t) => [index('notification_user_idx').on(t.userId, t.isRead)],
);

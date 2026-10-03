/**
 * Seller notifications (H): a new contact on a listing, or a new review on the
 * shop. Written by the catalogue/reviews modules, read by the notifications
 * endpoint. Kept deliberately simple (no channels/preferences).
 */
import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { appUser } from './identity.js';

const now = sql`now()`;

/** Per-user notification preferences (which types to receive). Absence of a row
 *  means everything is on. */
export const notificationPref = pgTable('notification_pref', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => appUser.id, { onDelete: 'cascade' }),
  contactEnabled: boolean('contact_enabled').notNull().default(true),
  reviewEnabled: boolean('review_enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
});

export const notification = pgTable(
  'notification',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    /** 'contact' | 'review' | 'saved_search' | 'price_drop' */
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

/**
 * A device's push token (Expo push token), registered by the mobile app for a
 * signed-in user so alerts can be delivered as native push notifications. One
 * row per token; re-registering refreshes `lastSeenAt` and re-owns the token.
 */
export const devicePushToken = pgTable(
  'device_push_token',
  {
    token: text('token').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    /** 'ios' | 'android' | 'web' */
    platform: text('platform').notNull().default('unknown'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().default(now),
  },
  (t) => [index('device_push_token_user_idx').on(t.userId)],
);

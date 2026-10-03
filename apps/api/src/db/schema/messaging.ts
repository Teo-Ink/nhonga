/**
 * In-app messaging (I): a conversation is between a buyer (app user) and a
 * seller (vendor, reachable by any of its owners), optionally about a listing.
 * Contact-first stays — WhatsApp/phone remain — this just adds an on-platform
 * thread so buyers without WhatsApp can reach a seller.
 */
import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { appUser } from './identity.js';
import { vendor } from './vendors.js';
import { product } from './catalog.js';

const now = sql`now()`;

export const conversation = pgTable(
  'conversation',
  {
    id: uuid('id').primaryKey(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    buyerUserId: uuid('buyer_user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => product.id, { onDelete: 'set null' }),
    /** Listing title snapshot, so the thread still reads after the ad is gone. */
    productTitle: text('product_title'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().default(now),
    buyerLastReadAt: timestamp('buyer_last_read_at', { withTimezone: true }),
    sellerLastReadAt: timestamp('seller_last_read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (t) => [
    index('conversation_buyer_idx').on(t.buyerUserId),
    index('conversation_vendor_idx').on(t.vendorId),
  ],
);

export const message = pgTable(
  'message',
  {
    id: uuid('id').primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    senderUserId: uuid('sender_user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (t) => [index('message_conversation_idx').on(t.conversationId, t.createdAt)],
);

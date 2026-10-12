/**
 * Referral attribution + rewards (H). When a new user signs up having followed
 * someone's invite link, a row records who referred whom. One row per referred
 * user (unique), so attribution happens once. If the referrer has a seller
 * wallet, loyalty points are credited and the row is 'rewarded'; otherwise it
 * stays 'pending' (the friend still counts).
 */
import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { appUser } from './identity.js';

const now = sql`now()`;

export const referral = pgTable(
  'referral',
  {
    id: uuid('id').primaryKey(),
    referrerUserId: uuid('referrer_user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    referredUserId: uuid('referred_user_id')
      .notNull()
      .unique()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    /** The invite code used (the referrer's short code). */
    code: text('code').notNull(),
    rewardPoints: integer('reward_points').notNull().default(0),
    /** 'pending' (recorded, not yet rewarded) | 'rewarded' (points credited). */
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (t) => [index('referral_referrer_idx').on(t.referrerUserId)],
);

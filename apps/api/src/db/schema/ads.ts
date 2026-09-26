/**
 * Display-ad campaigns (house-ads monetisation).
 *
 * A campaign books one of the on-site ad slots (leaderboard / mpu / inline),
 * optionally targeted to a category, for a date window. The creative is an image
 * URL (no file upload yet) plus a click-through URL. Impressions and clicks are
 * counted for reporting. Real billing rides the existing payments module.
 */

import { sql } from 'drizzle-orm';
import { bigint, check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const now = sql`now()`;

export const adCampaign = pgTable(
  'ad_campaign',
  {
    id: uuid('id').primaryKey(),
    advertiserName: text('advertiser_name').notNull(),
    /** Phone/email the advertiser is reachable on (never shown publicly). */
    advertiserContact: text('advertiser_contact'),
    /** Creative image URL and where the banner links. */
    imageUrl: text('image_url').notNull(),
    clickUrl: text('click_url').notNull(),
    /** Short alt/headline for accessibility. */
    headline: text('headline'),
    placement: text('placement').notNull(),
    /** Null = shown across all categories. */
    categorySlug: text('category_slug'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    priceCents: bigint('price_cents', { mode: 'number' }).notNull().default(0),
    status: text('status').notNull().default('pending'),
    impressions: integer('impressions').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index('ad_campaign_serve_idx').on(table.status, table.placement, table.categorySlug),
    check(
      'ad_campaign_placement_check',
      sql`${table.placement} in ('leaderboard','mpu','inline')`,
    ),
    check(
      'ad_campaign_status_check',
      sql`${table.status} in ('pending','active','paused','ended')`,
    ),
    check('ad_campaign_window_check', sql`${table.endsAt} > ${table.startsAt}`),
  ],
);

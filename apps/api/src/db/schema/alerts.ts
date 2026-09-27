/**
 * Saved searches with SMS alerts (F). A visitor saves a search and a phone
 * number; when new listings match, they get an SMS. The match query is stored
 * as the catalogue's own filter shape.
 */
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const now = sql`now()`;

export const savedSearch = pgTable(
  'saved_search',
  {
    id: uuid('id').primaryKey(),
    /** E.164 (2588…) — where the alert SMS is sent. */
    phoneE164: text('phone_e164').notNull(),
    label: text('label').notNull(),
    /** The results URL, used for the link in the alert. */
    href: text('href').notNull(),
    /** Catalogue filters (ProductFilters shape) used to match new listings. */
    query: jsonb('query').notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    /** Last time we checked/notified; new matches are those newer than this. */
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  },
  (t) => [index('saved_search_phone_idx').on(t.phoneE164)],
);

/**
 * Complaints (LEG-02).
 *
 * The formal channel the INTIC regulation asks for (Decreto 59/2023, art. 45):
 * anyone can complain about a payment, a listing, their account, privacy or
 * advertising, gets a reference, and the record is kept 5 years. Different
 * from a listing report, which is anonymous and about one listing.
 */

import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { appUser } from './identity.js';

const now = sql`now()`;

export const complaint = pgTable(
  'complaint',
  {
    id: uuid('id').primaryKey(),
    /** Shown to the person, e.g. "R-2026-4F7K2Q". */
    reference: text('reference').notNull().unique(),
    userId: uuid('user_id').references(() => appUser.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    /** Phone or email to answer on. */
    contact: text('contact').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    status: text('status').notNull().default('open'),
    resolution: text('resolution'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    index('complaint_status_idx').on(table.status, table.createdAt),
    check(
      'complaint_subject_check',
      sql`${table.subject} in ('payment','listing','account','privacy','advertising','other')`,
    ),
    check('complaint_status_check', sql`${table.status} in ('open','answered','closed')`),
  ],
);

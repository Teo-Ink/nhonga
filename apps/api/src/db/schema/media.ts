/**
 * Uploaded media (G). Listing photos captured from the seller's device.
 * With MEDIA_BUCKET set (P1-03), the bytes live in S3 and the row keeps the
 * object key; without it (a developer's machine), or for rows from before the
 * move, the bytes are held here base64-encoded. One of the two is always set
 * (migration 0023).
 */
import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const now = sql`now()`;

export const mediaAsset = pgTable(
  'media_asset',
  {
    id: uuid('id').primaryKey(),
    contentType: text('content_type').notNull(),
    /** base64 payload (no data: prefix), when not in object storage. */
    dataBase64: text('data_base64'),
    /** S3 object key, when in object storage. */
    storageKey: text('storage_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (t) => [
    check(
      'media_asset_bytes_or_key_check',
      sql`${t.dataBase64} is not null or ${t.storageKey} is not null`,
    ),
  ],
);

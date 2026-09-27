/**
 * Uploaded media (G). Listing photos captured from the seller's device. In the
 * demo there is no object store (S3/Cloudinary is gated), so the bytes are held
 * here, base64-encoded, and served by the media endpoint. Photos are already
 * compressed in the browser, so rows stay small.
 */
import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const now = sql`now()`;

export const mediaAsset = pgTable('media_asset', {
  id: uuid('id').primaryKey(),
  contentType: text('content_type').notNull(),
  /** base64 payload (no data: prefix). */
  dataBase64: text('data_base64').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
});

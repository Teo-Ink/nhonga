/**
 * AI Banner Studio. A banner is a promotional graphic for a listing, composed
 * by the platform (never a third-party image API in this build): Claude acts as
 * the art director and returns the copy + palette (`spec`), and a deterministic
 * SVG renderer turns that spec + the listing's own photo into the `svg` markup.
 * SVG is tiny and crisp at any size — ideal for low-bandwidth Mozambique — and
 * is served as image/svg+xml by the banners endpoint.
 *
 * One listing can have many banners (the seller generates variations and picks
 * one); the applied banner is referenced from `product.banner_id`. The free
 * monthly quota is counted from these rows per vendor, so no extra usage table
 * is needed.
 */
import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { product } from './catalog.js';
import { vendor } from './vendors.js';

const now = sql`now()`;

/** The art-direction spec Claude returns and the renderer consumes. */
export interface BannerSpec {
  /** Short punchy hook (<= ~28 chars), e.g. "Entrega em Maputo". */
  headline: string;
  /** Optional supporting line (<= ~48 chars). */
  subheadline: string;
  /** Short call to action, e.g. "Contacta já". */
  cta: string;
  /** Hex background/base colour. */
  bg: string;
  /** Hex accent (badges, CTA). */
  accent: string;
  /** Hex text colour that reads on `bg`. */
  text: string;
}

export const listingBanner = pgTable(
  'listing_banner',
  {
    id: uuid('id').primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    /** Style preset slug (moderno, minimal, promocao, luxo, alegre, mercado). */
    preset: text('preset').notNull(),
    /** Aspect ratio slug (square, landscape, portrait). */
    ratio: text('ratio').notNull(),
    spec: jsonb('spec').$type<BannerSpec>().notNull(),
    /** Rendered SVG markup, served as image/svg+xml. */
    svg: text('svg').notNull(),
    /** Free-tier banners carry the Nhonga watermark; Pro shops do not. */
    watermarked: boolean('watermarked').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (t) => [
    index('listing_banner_vendor_idx').on(t.vendorId, t.createdAt),
    index('listing_banner_product_idx').on(t.productId),
  ],
);

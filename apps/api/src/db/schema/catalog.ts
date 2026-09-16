/**
 * Categories, products, variants, and the stock ledger.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { vendor } from './vendors.js';

const now = sql`now()`;

/** Three levels maximum. Deeper taxonomies rot — vendors mis-categorise and buyers stop
 *  trusting filters. */
export const category = pgTable(
  'category',
  {
    id: uuid('id').primaryKey(),
    parentId: uuid('parent_id'),
    slug: text('slug').notNull(),
    namePt: text('name_pt').notNull(),
    nameEn: text('name_en').notNull(),
    level: smallint('level').notNull(),
    iconKey: text('icon_key'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('category_slug_key').on(table.slug),
    index('category_parent_idx').on(table.parentId),
    check('category_level_check', sql`${table.level} between 1 and 3`),
    check(
      'category_root_check',
      sql`(${table.level} = 1 and ${table.parentId} is null) or (${table.level} > 1 and ${table.parentId} is not null)`,
    ),
  ],
);

/** Typed, per-category attribute definitions. These are what make filters and variants work,
 *  and they are admin-managed rather than hardcoded. */
export const categoryAttribute = pgTable(
  'category_attribute',
  {
    id: uuid('id').primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => category.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    labelPt: text('label_pt').notNull(),
    labelEn: text('label_en').notNull(),
    dataType: text('data_type').notNull(),
    /** Allowed values for enum attributes, e.g. ["S","M","L"]. */
    options: jsonb('options').$type<string[]>(),
    isVariantAxis: boolean('is_variant_axis').notNull().default(false),
    isFilterable: boolean('is_filterable').notNull().default(true),
    isRequired: boolean('is_required').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    uniqueIndex('category_attribute_key').on(table.categoryId, table.key),
    check(
      'category_attribute_type_check',
      sql`${table.dataType} in ('text','number','boolean','enum')`,
    ),
  ],
);

export const product = pgTable(
  'product',
  {
    id: uuid('id').primaryKey(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => category.id),
    slug: text('slug').notNull(),
    titlePt: text('title_pt').notNull(),
    titleEn: text('title_en'),
    descriptionPt: text('description_pt'),
    descriptionEn: text('description_en'),
    /** Typed against categoryAttribute. GIN-indexed for filtering. */
    attributes: jsonb('attributes').$type<Record<string, string>>().notNull().default({}),
    status: text('status').notNull().default('draft'),
    weightGrams: integer('weight_grams'),
    /** Denormalised from review, maintained by a worker. */
    ratingAvg: numeric('rating_avg', { precision: 2, scale: 1 }),
    ratingCount: integer('rating_count').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    uniqueIndex('product_slug_key').on(table.slug),
    index('product_vendor_status_idx').on(table.vendorId, table.status),
    index('product_category_active_idx')
      .on(table.categoryId)
      .where(sql`${table.status} = 'active'`),
    index('product_attributes_gin').using('gin', table.attributes),
    check(
      'product_status_check',
      sql`${table.status} in ('draft','pending_review','active','suspended','archived')`,
    ),
    check('product_weight_check', sql`${table.weightGrams} is null or ${table.weightGrams} > 0`),
  ],
);

export const productImage = pgTable(
  'product_image',
  {
    id: uuid('id').primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    s3Key: text('s3_key').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    /** Inline base64 placeholder, under 400 bytes, rendered instantly (D-09). */
    lqip: text('lqip'),
    altText: text('alt_text'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [index('product_image_product_idx').on(table.productId, table.sortOrder)],
);

export const productVariant = pgTable(
  'product_variant',
  {
    id: uuid('id').primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    /** e.g. {"cor":"Preto","tamanho":"M"} */
    options: jsonb('options').$type<Record<string, string>>().notNull().default({}),
    priceCents: bigint('price_cents', { mode: 'number' }).notNull(),
    compareAtCents: bigint('compare_at_cents', { mode: 'number' }),
    stockQuantity: integer('stock_quantity').notNull().default(0),
    /** Below this, the product page shows the exact count ("Apenas 3 em stock"). */
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('product_variant_sku_key').on(table.productId, table.sku),
    index('product_variant_product_idx').on(table.productId),
    check('product_variant_price_check', sql`${table.priceCents} >= 0`),
    check(
      'product_variant_compare_check',
      sql`${table.compareAtCents} is null or ${table.compareAtCents} >= 0`,
    ),
    /**
     * The constraint that makes overselling impossible.
     *
     * Not a guideline and not an application check — a transaction that would drive stock
     * negative simply cannot commit. Checkout still takes `SELECT ... FOR UPDATE` to serialise
     * concurrent buyers and give them a clean error, but this is the backstop that holds even
     * if that code is wrong.
     */
    check('product_variant_stock_check', sql`${table.stockQuantity} >= 0`),
  ],
);

/**
 * Every movement of stock, with a reason and a reference.
 *
 * `productVariant.stockQuantity` is a fast denormalised read; this is the truth. When stock is
 * wrong — and eventually it will be — the ledger is how we find out why. A bare counter that
 * drifts is unauditable, and the vendor will ask.
 */
export const stockLedger = pgTable(
  'stock_ledger',
  {
    id: uuid('id').primaryKey(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariant.id),
    delta: integer('delta').notNull(),
    reason: text('reason').notNull(),
    /** The order or sub-order that caused the movement. */
    referenceId: uuid('reference_id'),
    actorId: uuid('actor_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index('stock_ledger_variant_idx').on(table.variantId, table.createdAt.desc()),
    index('stock_ledger_reference_idx').on(table.referenceId),
    check(
      'stock_ledger_reason_check',
      sql`${table.reason} in ('vendor_adjust','order_reserve','order_release','order_cancel','return','recount','import')`,
    ),
    check('stock_ledger_delta_check', sql`${table.delta} <> 0`),
  ],
);

/**
 * Vendors, KYC, payout accounts, and commission configuration.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { appUser, district } from './identity.js';

const now = sql`now()`;

export const vendor = pgTable(
  'vendor',
  {
    id: uuid('id').primaryKey(),
    slug: text('slug').notNull(),
    legalName: text('legal_name').notNull(),
    displayName: text('display_name').notNull(),
    vendorType: text('vendor_type').notNull(),
    /** Encrypted at rest via pgcrypto with a KMS-held key. */
    nuitEncrypted: text('nuit_encrypted'),
    districtId: uuid('district_id').references(() => district.id),
    status: text('status').notNull().default('pending_kyc'),

    kycReviewedBy: uuid('kyc_reviewed_by'),
    kycReviewedAt: timestamp('kyc_reviewed_at', { withTimezone: true }),
    /** Mandatory on rejection — it is what makes an appeal, or a regulator's question,
     *  answerable. Enforced in the service layer, not by a constraint, because the column is
     *  also used for information requests. */
    kycReason: text('kyc_reason'),

    ratingAvg: numeric('rating_avg', { precision: 2, scale: 1 }),
    ratingCount: integer('rating_count').notNull().default(0),
    /** Drives the "responde em ~2h" trust signal on the product page. */
    medianResponseMinutes: integer('median_response_minutes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    uniqueIndex('vendor_slug_key').on(table.slug),
    index('vendor_status_idx').on(table.status),
    check('vendor_type_check', sql`${table.vendorType} in ('individual','company')`),
    check(
      'vendor_status_check',
      sql`${table.status} in ('pending_kyc','info_requested','active','suspended','rejected','closed')`,
    ),
  ],
);

/** Staff accounts on a vendor, with per-user roles. */
export const vendorUser = pgTable(
  'vendor_user',
  {
    id: uuid('id').primaryKey(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    uniqueIndex('vendor_user_key').on(table.vendorId, table.userId),
    index('vendor_user_user_idx').on(table.userId),
    check('vendor_user_role_check', sql`${table.role} in ('owner','manager','staff')`),
  ],
);

export const kycDocument = pgTable(
  'kyc_document',
  {
    id: uuid('id').primaryKey(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    docType: text('doc_type').notNull(),
    /** S3 key in the KYC bucket — SSE-KMS, no public access, access-logged. Reading one of
     *  these is itself an auditable act (security architecture §7). */
    s3Key: text('s3_key').notNull(),
    status: text('status').notNull().default('pending'),
    rejectionReason: text('rejection_reason'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index('kyc_document_vendor_idx').on(table.vendorId),
    check(
      'kyc_document_type_check',
      sql`${table.docType} in ('id_front','id_back','selfie','nuit','alvara','bank_proof')`,
    ),
    check('kyc_document_status_check', sql`${table.status} in ('pending','accepted','rejected')`),
  ],
);

/**
 * Where a vendor is paid.
 *
 * `holderName` must match the verified KYC identity — mismatch is the single clearest fraud
 * signal in marketplace payouts and the cheapest one to check. Changes require OTP plus a 24h
 * cooling-off before the next payout runs.
 */
export const payoutAccount = pgTable(
  'payout_account',
  {
    id: uuid('id').primaryKey(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    method: text('method').notNull(),
    holderName: text('holder_name').notNull(),
    /** Encrypted at rest. MSISDN for a wallet, account number for a bank. */
    accountEncrypted: text('account_encrypted').notNull(),
    bankName: text('bank_name'),
    isActive: boolean('is_active').notNull().default(true),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    /** Payouts are suppressed until this passes — the cooling-off window. */
    usableFrom: timestamp('usable_from', { withTimezone: true }).notNull().default(now),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index('payout_account_vendor_idx').on(table.vendorId),
    uniqueIndex('payout_account_active_key')
      .on(table.vendorId)
      .where(sql`${table.isActive}`),
    check('payout_account_method_check', sql`${table.method} in ('mpesa','emola','mkesh','bank')`),
  ],
);

/**
 * Commission rules (D-17, OQ-4).
 *
 * Category-tiered percentage plus a fixed per-order fee. Rates are **basis points** so no
 * floating-point percentage can enter a fee calculation.
 *
 * Never updated in place: a change closes the current row with `effectiveTo` and inserts a new
 * one. The applied rule id is stored on each settlement, so a vendor asking in 2028 why they
 * were charged 12% on a 2026 order gets an exact answer.
 */
export const commissionRule = pgTable(
  'commission_rule',
  {
    id: uuid('id').primaryKey(),
    /** Null = platform default. */
    categoryId: uuid('category_id'),
    /** Null = applies to all vendors. A row with both set is the most specific match. */
    vendorId: uuid('vendor_id').references(() => vendor.id),
    percentageBps: integer('percentage_bps').notNull(),
    fixedFeeCents: bigint('fixed_fee_cents', { mode: 'number' }).notNull().default(0),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index('commission_rule_lookup_idx').on(table.categoryId, table.vendorId, table.effectiveFrom),
    check(
      'commission_rule_bps_check',
      sql`${table.percentageBps} >= 0 and ${table.percentageBps} <= 10000`,
    ),
    check('commission_rule_fee_check', sql`${table.fixedFeeCents} >= 0`),
    check(
      'commission_rule_window_check',
      sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
  ],
);

/**
 * Identity, sessions, geography, and addresses.
 *
 * Phone-first: the MSISDN is the account identifier and also the wallet identifier (D-04, D-05).
 * Email exists but is never required to transact.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  inet,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const now = sql`now()`;

export const appUser = pgTable(
  'app_user',
  {
    id: uuid('id').primaryKey(),
    phoneE164: text('phone_e164').notNull(),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    email: text('email'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    displayName: text('display_name').notNull(),
    locale: text('locale').notNull().default('pt-MZ'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
    /** Soft delete. PII is anonymised 30 days later; orders are retained — a deletion that
     *  orphaned orders would make the books unauditable, which no jurisdiction permits. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('app_user_phone_key').on(table.phoneE164),
    uniqueIndex('app_user_email_key').on(table.email),
    index('app_user_active_phone_idx')
      .on(table.phoneE164)
      .where(sql`${table.deletedAt} is null`),
    check('app_user_locale_check', sql`${table.locale} in ('pt-MZ','en')`),
    check('app_user_status_check', sql`${table.status} in ('active','suspended','deleted')`),
    check('app_user_phone_format_check', sql`${table.phoneE164} ~ '^\\+258[8][2-7][0-9]{7}$'`),
  ],
);

/**
 * OTP challenges.
 *
 * The plaintext code exists only in the SMS payload and in memory for the duration of the send.
 * What is stored is an Argon2id hash, so a database leak does not hand out live login codes.
 */
export const otpChallenge = pgTable(
  'otp_challenge',
  {
    id: uuid('id').primaryKey(),
    phoneE164: text('phone_e164').notNull(),
    codeHash: text('code_hash').notNull(),
    purpose: text('purpose').notNull(),
    attempts: smallint('attempts').notNull().default(0),
    maxAttempts: smallint('max_attempts').notNull().default(5),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdIp: inet('created_ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index('otp_challenge_phone_idx').on(table.phoneE164, table.createdAt.desc()),
    check(
      'otp_challenge_purpose_check',
      sql`${table.purpose} in ('login','verify_phone','payout_change')`,
    ),
  ],
);

/**
 * Refresh tokens, rotating.
 *
 * `familyId` implements reuse detection: presenting an already-rotated token revokes the entire
 * family, because the only reason to present an old token is that it was stolen.
 */
export const refreshToken = pgTable(
  'refresh_token',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    /** SHA-256. The raw token is never stored. */
    tokenHash: text('token_hash').notNull(),
    familyId: uuid('family_id').notNull(),
    deviceLabel: text('device_label'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    uniqueIndex('refresh_token_hash_key').on(table.tokenHash),
    index('refresh_token_family_idx').on(table.familyId),
    index('refresh_token_user_idx').on(table.userId),
  ],
);

// ── Geography ────────────────────────────────────────────────────────────────
// Reference data, seeded from the national administrative divisions. Delivery fees and zones
// key off district and nothing else.

export const province = pgTable('province', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
});

export const district = pgTable(
  'district',
  {
    id: uuid('id').primaryKey(),
    provinceCode: text('province_code')
      .notNull()
      .references(() => province.code),
    name: text('name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    index('district_province_idx').on(table.provinceCode),
    uniqueIndex('district_province_name_key').on(table.provinceCode, table.name),
  ],
);

/**
 * Hybrid structured + informal addressing (D-10).
 *
 * Structured fields drive delivery zones and fees. `landmark` is what actually finds the house,
 * and is therefore required — much of the country outside central Maputo has no reliable street
 * addressing, and a purely structured model would force people to lie.
 */
export const address = pgTable(
  'address',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    label: text('label'),
    recipientName: text('recipient_name').notNull(),
    phoneE164: text('phone_e164').notNull(),

    provinceCode: text('province_code')
      .notNull()
      .references(() => province.code),
    districtId: uuid('district_id')
      .notNull()
      .references(() => district.id),
    bairro: text('bairro').notNull(),
    quarteirao: text('quarteirao'),
    houseNumber: text('house_number'),

    landmark: text('landmark').notNull(),
    notes: text('notes'),

    /** Opt-in only, captured with an explicit explanation. Never harvested silently. */
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),

    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('address_user_idx').on(table.userId),
    index('address_district_idx').on(table.districtId),
    // At most one default per user.
    uniqueIndex('address_user_default_key')
      .on(table.userId)
      .where(sql`${table.isDefault} and ${table.deletedAt} is null`),
  ],
);

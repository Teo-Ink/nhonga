/**
 * Cross-cutting infrastructure tables: the transactional outbox, idempotency keys, and the
 * audit log.
 */

import { sql } from 'drizzle-orm';
import {
  check,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const now = sql`now()`;

/**
 * Transactional outbox.
 *
 * Domain events are written here **inside the same transaction as the state change**, then
 * relayed to BullMQ by a poller. Publishing directly to Redis from inside a transaction produces
 * the two classic bugs: an event published for a transaction that then rolls back (a
 * notification for an order that does not exist), or a committed transaction whose event was
 * lost when the process died.
 *
 * The outbox makes event publication exactly as durable as the state change it describes.
 */
export const outbox = pgTable(
  'outbox',
  {
    id: uuid('id').primaryKey(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    /** Monotonic per aggregate. Consumers are idempotent, but ordering still matters for
     *  anything that projects state. */
    sequence: integer('sequence').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    attempts: smallint('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    /** The relay poller's index. Partial, so it stays small as published rows accumulate. */
    index('outbox_unpublished_idx')
      .on(table.createdAt)
      .where(sql`${table.publishedAt} is null`),
    index('outbox_aggregate_idx').on(table.aggregateType, table.aggregateId, table.sequence),
    uniqueIndex('outbox_aggregate_sequence_key').on(
      table.aggregateType,
      table.aggregateId,
      table.sequence,
    ),
  ],
);

/**
 * Idempotency keys.
 *
 * The full response is stored against the key and replayed verbatim on a repeat. This is what
 * makes the pay button safe to double-tap on a bad connection, and what makes the mobile retry
 * queue safe to replay after a crash.
 *
 * `requestHash` guards against a client reusing a key for a *different* request — which is a bug
 * on their side, but one that would otherwise return them someone else's order.
 */
export const idempotencyKey = pgTable(
  'idempotency_key',
  {
    key: text('key').primaryKey(),
    userId: uuid('user_id'),
    endpoint: text('endpoint').notNull(),
    requestHash: text('request_hash').notNull(),
    status: text('status').notNull().default('in_progress'),
    responseStatus: integer('response_status'),
    responseBody: jsonb('response_body').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    /** Swept after 24 hours. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('idempotency_key_expiry_idx').on(table.expiresAt),
    index('idempotency_key_user_idx').on(table.userId),
    check(
      'idempotency_key_status_check',
      sql`${table.status} in ('in_progress','completed','failed')`,
    ),
  ],
);

/**
 * Audit log.
 *
 * Written for every financial action, every admin action, every vendor status change, and every
 * permission change — including an admin *reading* a KYC document, because looking at someone's
 * identity papers is itself an auditable act.
 *
 * Append-only, enforced by a trigger rather than by convention: a log the application can quietly
 * rewrite is not an audit log. See the migration that creates `audit_log_immutable`.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey(),
    actorId: uuid('actor_id'),
    actorType: text('actor_type').notNull(),
    /** Dotted action name, e.g. 'vendor.approve', 'settlement.release', 'kyc.document.view'. */
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    reason: text('reason'),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (table) => [
    index('audit_log_entity_idx').on(table.entityType, table.entityId, table.createdAt.desc()),
    index('audit_log_actor_idx').on(table.actorId, table.createdAt.desc()),
    index('audit_log_action_idx').on(table.action, table.createdAt.desc()),
    check(
      'audit_log_actor_type_check',
      sql`${table.actorType} in ('user','vendor','admin','system')`,
    ),
  ],
);

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema/index.js';

/**
 * The database handle, generic over our schema.
 *
 * Services accept this rather than `any` so that a mistyped column or a table
 * from another module's schema is caught at compile time. The checkout and
 * settlement paths are exactly where a silently-wrong column name becomes a
 * money bug.
 */
export type Db = PostgresJsDatabase<typeof schema>;

/**
 * The handle inside `db.transaction(...)`.
 *
 * Derived from Db rather than imported, because Drizzle's transaction type is
 * an internal generic whose import path has moved between minor versions.
 * Deriving it means a Drizzle upgrade cannot silently widen this to `any`.
 */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

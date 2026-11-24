import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema/index.js';
import type { Db } from '../db/types.js';

/**
 * Database-backed tests run only when TEST_DATABASE_URL points at a disposable
 * Postgres (CI service container or a local scratch database). Without it the
 * suites are skipped, so `pnpm test` stays runnable with no database.
 */
export const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'] ?? '';
export const hasTestDb = TEST_DATABASE_URL !== '';

let migrated = false;

/** Applies all migrations (the same script the container runs) once per process. */
export function migrateTestDb(): void {
  if (migrated) return;
  const script = fileURLToPath(new URL('../../scripts/migrate.mjs', import.meta.url));
  execFileSync(process.execPath, [script], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, SEED_DEMO: '' },
    stdio: 'pipe',
  });
  migrated = true;
}

export function openTestDb(): { db: Db; close: () => Promise<void> } {
  const sql = postgres(TEST_DATABASE_URL, { max: 30, onnotice: () => {} });
  return { db: drizzle(sql, { schema }), close: () => sql.end() };
}

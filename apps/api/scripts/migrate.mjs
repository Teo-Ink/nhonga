// Container start-up migrations: drizzle's journaled migrations, then the
// hand-written ones. Runs before the API (see Dockerfile CMD). A Postgres
// advisory lock makes concurrent starts (several ECS tasks at once) take turns,
// so each migration runs exactly once. Exits non-zero on failure, so a task
// with a broken migration never starts serving.
//
//   DATABASE_URL=... node scripts/migrate.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { applyManualMigrations } from './manual-migrations.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('migrate: DATABASE_URL is not set');
  process.exit(1);
}
const LOCK_KEY = 7_204_331_901; // arbitrary, fixed: "nhonga migrations"
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql`select pg_advisory_lock(${LOCK_KEY})`;
  await migrate(drizzle(sql), { migrationsFolder: dir });
  console.log('migrate: drizzle migrations up to date');
  await applyManualMigrations(sql, dir, (m) => console.log(`migrate: ${m}`));
  console.log('migrate: done');
} catch (e) {
  console.error(`migrate: FAILED: ${e.message}`);
  process.exitCode = 1;
} finally {
  await sql`select pg_advisory_unlock(${LOCK_KEY})`.catch(() => {});
  await sql.end();
}

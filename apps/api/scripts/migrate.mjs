// Container start-up migrations: drizzle's journaled migrations, then the
// hand-written ones. Runs before the API (see Dockerfile CMD). A Postgres
// advisory lock makes concurrent starts (several ECS tasks at once) take turns,
// so each migration runs exactly once. Exits non-zero on failure, so a task
// with a broken migration never starts serving.
//
//   DATABASE_URL=... node scripts/migrate.mjs
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { applyManualMigrations } from './manual-migrations.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'drizzle');
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
  await seedDemoIfRequested(sql);
  console.log('migrate: done');
} catch (e) {
  console.error(`migrate: FAILED: ${e.message}`);
  process.exitCode = 1;
} finally {
  await sql`select pg_advisory_unlock(${LOCK_KEY})`.catch(() => {});
  await sql.end();
}

/**
 * Staging only: load the demo catalogue into a brand-new database, so a fresh
 * environment has something to browse. seed.sql TRUNCATEs the catalogue and
 * users, so it runs only when there are no categories and no users yet, and
 * never when NODE_ENV is production.
 */
async function seedDemoIfRequested(db) {
  if (process.env.SEED_DEMO !== '1') return;
  if (process.env.NODE_ENV === 'production') {
    console.log('migrate: SEED_DEMO ignored in production');
    return;
  }
  const [{ categories, users }] = await db`
    select (select count(*) from category)::int as categories,
           (select count(*) from app_user)::int as users`;
  if (categories > 0 || users > 0) {
    console.log('migrate: demo seed skipped (database already has data)');
    return;
  }
  for (const file of ['seed.sql', 'districts.sql']) {
    await db.unsafe(await readFile(join(here, file), 'utf8'));
    console.log(`migrate: demo seed applied (${file})`);
  }
}

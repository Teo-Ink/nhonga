// Dev helper: applies only the hand-written migrations (see manual-migrations.mjs).
// dev-start runs this before the API. Uses DATABASE_URL, falling back to the
// local docker-compose database.
//
//   node scripts/apply-manual-migrations.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { applyManualMigrations } from './manual-migrations.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');
const url = process.env.DATABASE_URL ?? 'postgresql://nhonga:nhonga@localhost:5432/nhonga';
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await applyManualMigrations(sql, dir);
} catch (e) {
  console.error(`migration failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}

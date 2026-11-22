// Shared by migrate.mjs (container start) and apply-manual-migrations.mjs (dev).
//
// Hand-written migrations are the drizzle/NNNN_*.sql files that are not in
// drizzle's journal (0016 onwards). Each is applied once, in its own
// transaction, and recorded in "_manual_migration". A file that fails with
// "already exists" but was never recorded is treated as applied by hand
// before this runner existed, and recorded.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ALREADY_EXISTS = new Set(['42P07', '42710']); // duplicate_table, duplicate_object

export async function applyManualMigrations(sql, migrationsDir, log = console.log) {
  const journal = JSON.parse(readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8'));
  const journaled = new Set(journal.entries.map((e) => e.tag));
  const files = readdirSync(migrationsDir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f) && !journaled.has(f.replace(/\.sql$/, '')))
    .sort();

  await sql`create table if not exists "_manual_migration" (
    name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select name from "_manual_migration"`).map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    try {
      await sql.begin((tx) => tx.unsafe(readFileSync(join(migrationsDir, f), 'utf8')));
      log(`applied ${f}`);
    } catch (e) {
      if (!ALREADY_EXISTS.has(e.code)) throw e;
      log(`${f} was already applied by hand; recording it`);
    }
    await sql`insert into "_manual_migration" (name) values (${f}) on conflict do nothing`;
  }
}

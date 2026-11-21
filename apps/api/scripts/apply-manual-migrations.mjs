// Applies the hand-written migrations that are not in drizzle's journal
// (0016 onwards were written by hand), once each, recording them in
// "_manual_migration". Safe to run on every start. A file that fails with
// "already exists" and was never recorded is treated as applied by hand before
// this runner existed, and recorded. Uses DATABASE_URL, falling back to the
// local docker-compose database.
//
//   node scripts/apply-manual-migrations.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'drizzle');
const journal = JSON.parse(readFileSync(join(dir, 'meta', '_journal.json'), 'utf8'));
const journaled = new Set(journal.entries.map((e) => e.tag));

const files = readdirSync(dir)
  .filter((f) => /^\d{4}_.+\.sql$/.test(f) && !journaled.has(f.replace(/\.sql$/, '')))
  .sort();

const url = process.env.DATABASE_URL ?? 'postgresql://nhonga:nhonga@localhost:5432/nhonga';
const sql = postgres(url, { max: 1, onnotice: () => {} });
const ALREADY_EXISTS = new Set(['42P07', '42710']); // duplicate_table, duplicate_object
try {
  await sql`create table if not exists "_manual_migration" (
    name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select name from "_manual_migration"`).map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    try {
      await sql.begin((tx) => tx.unsafe(readFileSync(join(dir, f), 'utf8')));
      console.log(`applied ${f}`);
    } catch (e) {
      if (!ALREADY_EXISTS.has(e.code)) throw e;
      console.log(`${f} was already applied by hand; recording it`);
    }
    await sql`insert into "_manual_migration" (name) values (${f}) on conflict do nothing`;
  }
} catch (e) {
  console.error(`migration failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}

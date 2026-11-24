import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/types.js';
import { hasTestDb, migrateTestDb, openTestDb } from '../test/pg.js';
import { postgresCounter } from './shared-limit.js';

// P0-04: two instances (two counters, two connection pools) share one count.
describe.skipIf(!hasTestDb)('postgresCounter (Postgres)', () => {
  let a: { db: Db; close: () => Promise<void> };
  let b: { db: Db; close: () => Promise<void> };

  beforeAll(() => {
    migrateTestDb();
    a = openTestDb();
    b = openTestDb();
  });
  afterAll(async () => {
    await a.close();
    await b.close();
  });

  it('counts concurrent hits from two instances exactly once each', async () => {
    const key = `t:${randomUUID()}`;
    const ca = postgresCounter(a.db);
    const cb = postgresCounter(b.db);
    const hits = await Promise.all(
      Array.from({ length: 40 }, (_, i) => (i % 2 ? ca : cb)(key, 3600)),
    );
    expect(Math.max(...hits)).toBe(40);
    expect(new Set(hits).size).toBe(40);
  });
});

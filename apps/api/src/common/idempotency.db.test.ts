import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/types.js';
import { hasTestDb, migrateTestDb, openTestDb } from '../test/pg.js';
import { idempotencyMiddleware, postgresIdemStore } from './idempotency.js';

// P2-11: a retried payment request is answered once, never charged twice.
describe.skipIf(!hasTestDb)('Idempotency-Key (Postgres)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let base = '';
  let server: ReturnType<express.Express['listen']>;
  let charges = 0;

  beforeAll(async () => {
    migrateTestDb();
    ({ db, close } = openTestDb());
    const app = express();
    app.use(express.json());
    app.use(idempotencyMiddleware(postgresIdemStore(db)));
    app.post('/wallet/topup', async (req, res) => {
      await new Promise((r) => setTimeout(r, 150)); // a slow gateway
      charges++;
      res.status(201).json({ charged: req.body.amountCents, n: charges });
    });
    app.post('/wallet/purchase', (_req, res) => {
      res.status(503).json({ detail: 'gateway down' });
    });
    await new Promise<void>((ok) => {
      server = app.listen(0, () => ok());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server?.close();
    await close();
  });

  const post = (path: string, key: string | null, body: unknown, token = 'tok-a') =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...(key ? { 'idempotency-key': key } : {}),
      },
      body: JSON.stringify(body),
    });

  it('replays the first answer to a retry, and charges once', async () => {
    const key = randomUUID();
    const before = charges;
    const first = await post('/wallet/topup', key, { amountCents: 5000 });
    const again = await post('/wallet/topup', key, { amountCents: 5000 });
    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.headers.get('idempotent-replayed')).toBe('true');
    expect(await again.json()).toEqual(await first.json());
    expect(charges - before).toBe(1);
  });

  it('answers 409 to a duplicate that arrives while the first still runs', async () => {
    const key = randomUUID();
    const [a, b] = await Promise.all([
      post('/wallet/topup', key, { amountCents: 100 }),
      new Promise((r) => setTimeout(r, 30)).then(() =>
        post('/wallet/topup', key, { amountCents: 100 }),
      ),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  it('refuses the same key with a different body, and keys are per caller', async () => {
    const key = randomUUID();
    await post('/wallet/topup', key, { amountCents: 100 });
    expect((await post('/wallet/topup', key, { amountCents: 999 })).status).toBe(422);
    const other = await post('/wallet/topup', key, { amountCents: 999 }, 'tok-b');
    expect(other.status).toBe(201);
    expect(other.headers.get('idempotent-replayed')).toBeNull();
  });

  it('lets a failed (5xx) request be retried, and works without a key', async () => {
    const key = randomUUID();
    expect((await post('/wallet/purchase', key, { packageId: 'p' })).status).toBe(503);
    await new Promise((r) => setTimeout(r, 50));
    const retry = await post('/wallet/purchase', key, { packageId: 'p' });
    expect(retry.headers.get('idempotent-replayed')).toBeNull();
    expect((await post('/wallet/topup', null, { amountCents: 1 })).status).toBe(201);
    expect((await post('/wallet/topup', 'bad key!', { amountCents: 1 })).status).toBe(400);
  });
});

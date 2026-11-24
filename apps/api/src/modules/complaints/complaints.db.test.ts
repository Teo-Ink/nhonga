import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../db/types.js';
import { hasTestDb, migrateTestDb, openTestDb } from '../../test/pg.js';
import type { AuthService } from '../auth/auth.service.js';
import { ComplaintsService, complaintReference } from './complaints.service.js';

describe('complaintReference', () => {
  it('is a year plus six unambiguous characters', () => {
    const ref = complaintReference(
      new Date('2026-11-24T00:00:00Z'),
      Buffer.from([0, 1, 2, 3, 4, 5]),
    );
    expect(ref).toBe('R-2026-ABCDEF');
    expect(complaintReference()).toMatch(/^R-\d{4}-[A-HJ-NP-Z2-9]{6}$/);
  });
});

describe.skipIf(!hasTestDb)('ComplaintsService (Postgres)', () => {
  let db: Db;
  let close: () => Promise<void>;
  const noAuth = { me: () => Promise.reject(new Error('no session')) } as unknown as AuthService;
  beforeAll(() => {
    migrateTestDb();
    ({ db, close } = openTestDb());
  });
  afterAll(async () => close());

  it('records a complaint without an account, lists it and keeps the answer', async () => {
    const svc = new ComplaintsService(db, noAuth);
    const input = {
      name: 'Ana Macuácua',
      contact: '+258840000000',
      subject: 'payment',
      body: 'Carreguei a carteira e o saldo não apareceu.',
    };
    const { reference } = await svc.create(input, 'expired-token');
    const open = await svc.list('open');
    expect(open.find((c) => c.reference === reference)).toMatchObject({ ...input, status: 'open' });

    const done = await svc.resolve(reference, {
      status: 'answered',
      resolution: 'Saldo creditado.',
    });
    expect(done).toMatchObject({ status: 'answered', resolution: 'Saldo creditado.' });
    expect(done.resolvedAt).not.toBeNull();
    await expect(
      svc.resolve('R-0000-NOPE', { status: 'closed', resolution: 'x' }),
    ).rejects.toThrow();
  });
});

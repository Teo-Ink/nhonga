import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { category, product } from '../../db/schema/catalog.js';
import { vendor } from '../../db/schema/vendors.js';
import type { Db } from '../../db/types.js';
import { hasTestDb, migrateTestDb, openTestDb } from '../../test/pg.js';
import { ListingExpiry, listingTtlDays } from './listing-expiry.js';

describe('listingTtlDays', () => {
  it('is off unless a positive whole number of days is set', () => {
    expect(listingTtlDays(undefined)).toBe(0);
    expect(listingTtlDays('abc')).toBe(0);
    expect(listingTtlDays('90')).toBe(90);
  });
});

describe.skipIf(!hasTestDb)('ListingExpiry (Postgres)', () => {
  let db: Db;
  let close: () => Promise<void>;
  beforeAll(() => {
    migrateTestDb();
    ({ db, close } = openTestDb());
  });
  afterAll(async () => close());

  it('archives listings untouched for longer than the limit, and only those', async () => {
    const catId = randomUUID();
    const vId = randomUUID();
    await db
      .insert(category)
      .values({ id: catId, slug: `exp-${vId.slice(0, 6)}`, namePt: 'E', nameEn: 'E', level: 1 });
    await db.insert(vendor).values({
      id: vId,
      slug: `exp-${vId.slice(0, 8)}`,
      legalName: 'E',
      displayName: 'E',
      vendorType: 'individual',
      status: 'active',
    });
    const old = new Date(Date.now() - 120 * 86_400_000);
    const mk = (published: Date, bumped: Date | null) => {
      const id = randomUUID();
      return db
        .insert(product)
        .values({
          id,
          vendorId: vId,
          categoryId: catId,
          slug: `exp-${id}`,
          titlePt: 'x',
          descriptionPt: '',
          attributes: {},
          status: 'active',
          publishedAt: published,
          bumpedAt: bumped,
          updatedAt: published,
        })
        .then(() => id);
    };
    const stale = await mk(old, null);
    const bumped = await mk(old, new Date());
    const fresh = await mk(new Date(), null);

    await new ListingExpiry(db).expire(90);
    const rows = await db
      .select({ id: product.id, status: product.status })
      .from(product)
      .where(inArray(product.id, [stale, bumped, fresh]));
    const status = Object.fromEntries(rows.map((r) => [r.id, r.status]));
    expect(status).toEqual({ [stale]: 'archived', [bumped]: 'active', [fresh]: 'active' });
    await db.delete(product).where(eq(product.vendorId, vId));
  });
});

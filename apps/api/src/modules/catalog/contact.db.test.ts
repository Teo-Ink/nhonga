import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { category, product } from '../../db/schema/catalog.js';
import { vendor } from '../../db/schema/vendors.js';
import type { Db } from '../../db/types.js';
import { hasTestDb, migrateTestDb, openTestDb } from '../../test/pg.js';
import { contactAvailability } from './catalog.mappers.js';
import { CatalogService } from './catalog.service.js';

// PRIV-01: public pages say which channels a seller offers; the digits are
// only returned by revealContact, one request at a time.
describe('contactAvailability', () => {
  const base = { whatsapp: '258841234567', contactPhone: '258841234567' };
  it('tells which channels exist and the operator prefix, never the number', () => {
    const c = contactAvailability({ ...base, showWhatsapp: true, showPhone: true });
    expect(c).toEqual({ whatsapp: true, phone: true, hint: '25884' });
    expect(JSON.stringify(c)).not.toContain('1234567');
  });
  it('respects channels the seller hides', () => {
    expect(contactAvailability({ ...base, showWhatsapp: false, showPhone: false })).toEqual({
      whatsapp: false,
      phone: false,
      hint: null,
    });
  });
});

describe.skipIf(!hasTestDb)('seller contact on request (Postgres)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let catalog: CatalogService;
  const tag = randomUUID().slice(0, 8);
  const shop = `ct-shop-${tag}`;
  const slug = `ct-item-${tag}`;

  beforeAll(async () => {
    migrateTestDb();
    ({ db, close } = openTestDb());
    // Collaborators (notifications, media…) are not under test: any call is a no-op.
    const quiet = new Proxy({}, { get: () => () => Promise.resolve() }) as never;
    catalog = new CatalogService(db, quiet, quiet, quiet, quiet);
    const catId = randomUUID();
    const vId = randomUUID();
    await db
      .insert(category)
      .values({ id: catId, slug: `ct-${tag}`, namePt: 'C', nameEn: 'C', level: 1 });
    await db.insert(vendor).values({
      id: vId,
      slug: shop,
      legalName: 'Loja',
      displayName: 'Loja',
      vendorType: 'individual',
      status: 'active',
      whatsapp: '258841234567',
      contactPhone: '258841234567',
      showWhatsapp: true,
      showPhone: false,
    });
    await db.insert(product).values({
      id: randomUUID(),
      vendorId: vId,
      categoryId: catId,
      slug,
      titlePt: 'Artigo',
      status: 'active',
      publishedAt: new Date(),
    });
  });
  afterAll(async () => close());

  it('keeps the digits out of the public listing and shop', async () => {
    const detail = await catalog.getProduct(slug, 'pt');
    expect(detail.vendor.whatsapp).toBeNull();
    expect(detail.vendor.phone).toBeNull();
    expect(detail.vendor.contact).toEqual({ whatsapp: true, phone: false, hint: '25884' });
    const shopDetail = await catalog.getShop(shop);
    expect(JSON.stringify([detail, shopDetail])).not.toContain('841234567');
  });

  it('returns the numbers on request, honours hidden channels, and counts a contact', async () => {
    const before = (await catalog.getProduct(slug, 'pt')).stats?.contacts ?? 0;
    expect(await catalog.revealContact({ productSlug: slug })).toEqual({
      whatsapp: '258841234567',
      phone: null,
    });
    expect(await catalog.revealContact({ vendorSlug: shop })).toEqual({
      whatsapp: '258841234567',
      phone: null,
    });
    const after = (await catalog.getProduct(slug, 'pt')).stats?.contacts ?? 0;
    expect(after).toBe(before + 1);
    await expect(catalog.revealContact({ productSlug: 'nao-existe' })).rejects.toThrow();
  });
});

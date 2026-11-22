import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { category, product, productVariant } from '../../db/schema/catalog.js';
import { vendor } from '../../db/schema/vendors.js';
import type { Db } from '../../db/types.js';
import { hasTestDb, migrateTestDb, openTestDb } from '../../test/pg.js';
import { CatalogService } from './catalog.service.js';

// P1-01: browse and search run in Postgres. These pin the behaviour the
// in-memory version had: order, filters, totals, accent-free matching.
describe.skipIf(!hasTestDb)('Catalogue browse and search in Postgres', () => {
  let db: Db;
  let close: () => Promise<void>;
  let catalog: CatalogService;
  const tag = randomUUID().slice(0, 6);
  const catSlug = `pesq-${tag}`;
  const shopSlug = `loja-pesq-${tag}`;
  let shopId: string;

  async function listing(
    title: string,
    priceCents: number,
    opts: {
      daysAgo?: number;
      featured?: boolean;
      stock?: number;
      attrs?: Record<string, string>;
    } = {},
  ) {
    const id = randomUUID();
    const [cat] = await db.select().from(category).where(eq(category.slug, catSlug));
    await db.insert(product).values({
      id,
      vendorId: shopId,
      categoryId: cat!.id,
      slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomUUID().slice(0, 6)}`,
      titlePt: title,
      descriptionPt: `${title} em bom estado`,
      attributes: opts.attrs ?? {},
      status: 'active',
      publishedAt: new Date(Date.now() - (opts.daysAgo ?? 0) * 86_400_000),
      featuredUntil: opts.featured ? new Date(Date.now() + 86_400_000) : null,
    });
    await db.insert(productVariant).values({
      id: randomUUID(),
      productId: id,
      sku: `T-${randomUUID().slice(0, 8)}`,
      priceCents,
      stockQuantity: opts.stock ?? 1,
    });
    return id;
  }

  beforeAll(async () => {
    migrateTestDb();
    ({ db, close } = openTestDb());
    catalog = new CatalogService(db, {} as never, {} as never, {} as never, {} as never);
    await db.insert(category).values({
      id: randomUUID(),
      slug: catSlug,
      namePt: 'Viaturas teste',
      nameEn: 'Cars',
      level: 1,
    });
    shopId = randomUUID();
    await db.insert(vendor).values({
      id: shopId,
      slug: shopSlug,
      legalName: 'Auto Sol',
      displayName: 'Auto Sol',
      vendorType: 'individual',
      status: 'active',
    });
    await listing('Toyota Hilux 2015', 850_000_00, { daysAgo: 3, attrs: { ano: '2015' } });
    await listing('Toyota Corolla 2010', 420_000_00, { daysAgo: 1, attrs: { ano: '2010' } });
    await listing('Mazda BT-50 Destaque', 990_000_00, {
      daysAgo: 9,
      featured: true,
      attrs: { ano: '2018' },
    });
    await listing('Nissan Hardbody esgotado', 300_000_00, {
      daysAgo: 2,
      stock: 0,
      attrs: { ano: '2008' },
    });
  });
  afterAll(async () => close());

  const titles = (r: { items: readonly { title: string }[] }) => r.items.map((i) => i.title);

  it('browses a category: Destaque first, then newest, with the total', async () => {
    const r = await catalog.listProducts('pt', { categorySlug: catSlug, limit: 2 });
    expect(r.total).toBe(4);
    expect(r.page.hasMore).toBe(true);
    expect(titles(r)).toEqual(['Mazda BT-50 Destaque', 'Toyota Corolla 2010']);
  });

  it('filters and sorts by the shown price, stock and attributes in SQL', async () => {
    const cheap = await catalog.listProducts('pt', {
      categorySlug: catSlug,
      maxPriceCents: 500_000_00,
      sort: 'price_asc',
    });
    expect(titles(cheap)).toEqual(['Nissan Hardbody esgotado', 'Toyota Corolla 2010']);
    const inStock = await catalog.listProducts('pt', { categorySlug: catSlug, inStockOnly: true });
    expect(titles(inStock)).not.toContain('Nissan Hardbody esgotado');
    const recent = await catalog.listProducts('pt', {
      categorySlug: catSlug,
      attributes: { ano: { min: 2012 } },
      sort: 'price_desc',
    });
    expect(titles(recent)).toEqual(['Mazda BT-50 Destaque', 'Toyota Hilux 2015']);
  });

  it('searches the stored document, ignoring accents and case', async () => {
    const r = await catalog.listProducts('pt', { q: 'TOYÓTA hilux', vendorSlug: shopSlug });
    expect(titles(r)).toEqual(['Toyota Hilux 2015']);
  });

  it('keeps the document current when the shop is renamed', async () => {
    await db
      .update(vendor)
      .set({ displayName: `Machambauto ${tag}x` })
      .where(eq(vendor.id, shopId));
    const r = await catalog.listProducts('pt', { q: `machambauto ${tag}x` });
    expect(r.total).toBe(4);
  });
});

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { category, product } from '../../db/schema/catalog.js';
import { appUser } from '../../db/schema/identity.js';
import { vendor } from '../../db/schema/vendors.js';
import type { Db } from '../../db/types.js';
import { hasTestDb, migrateTestDb, openTestDb } from '../../test/pg.js';
import { freshPhone, signIn } from '../../test/session.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { AccountService, DELETED_NAME } from './account.service.js';
import { AuthService } from './auth.service.js';

describe.skipIf(!hasTestDb)('Account deletion, export and blocks (Postgres)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let auth: AuthService;
  let account: AccountService;
  let catalog: CatalogService;
  let messaging: MessagingService;
  const catSlug = `conta-${randomUUID().slice(0, 8)}`;
  const quiet = { notifyVendorOwners: async () => {}, notifyUser: async () => {} };

  beforeAll(async () => {
    migrateTestDb();
    ({ db, close } = openTestDb());
    auth = new AuthService(db);
    account = new AccountService(db, auth);
    const media = { storeDataUrl: () => Promise.resolve(randomUUID()) };
    catalog = new CatalogService(db, media as never, auth, quiet as never, {} as never);
    messaging = new MessagingService(db, auth, quiet as never);
    await db
      .insert(category)
      .values({ id: randomUUID(), slug: catSlug, namePt: 'C', nameEn: 'C', level: 1 });
  });
  afterAll(async () => close());

  async function seller() {
    const s = await signIn(auth);
    const l = await catalog.createListing(
      { title: 'Bicicleta usada', categorySlug: catSlug, priceCents: 5_000_00, shopName: 'Loja X' },
      s.sessionToken,
    );
    const [p] = await db.select().from(product).where(eq(product.slug, l.slug));
    const [v] = await db.select().from(vendor).where(eq(vendor.id, p!.vendorId));
    return { ...s, listingSlug: l.slug, vendorSlug: v!.slug, vendorId: v!.id };
  }

  it('exports the person’s own data', async () => {
    const s = await seller();
    const data = await account.exportData(s.sessionToken);
    expect(data).toMatchObject({
      account: { phone: s.user.phoneE164 },
      listings: [expect.objectContaining({ slug: s.listingSlug })],
    });
  });

  it('deletes at once: sessions end, listings leave, the number is free again', async () => {
    const phone = freshPhone();
    const s = await signIn(auth, phone);
    await catalog.createListing(
      { title: 'Mesa de madeira', categorySlug: catSlug, priceCents: 1_000_00, shopName: 'Loja Y' },
      s.sessionToken,
    );
    await account.deleteAccount(s.sessionToken);

    await expect(auth.me(s.sessionToken)).rejects.toMatchObject({ code: 'unauthenticated' });
    const [u] = await db.select().from(appUser).where(eq(appUser.id, s.user.id));
    expect(u).toMatchObject({ status: 'deleted', displayName: DELETED_NAME, email: null });
    expect(u?.phoneE164).not.toContain(s.user.phoneE164.slice(4));

    const live = await catalog.listProducts('pt', { categorySlug: catSlug, q: 'Mesa de madeira' });
    expect(live.items.some((i) => i.title === 'Mesa de madeira')).toBe(false);

    // Same number, new account (a fresh service without the resend cooldown).
    process.env['OTP_RESEND_COOLDOWN_SECONDS'] = '1';
    await new Promise((r) => setTimeout(r, 1100));
    const again = await signIn(new AuthService(db), phone);
    delete process.env['OTP_RESEND_COOLDOWN_SECONDS'];
    expect(again.user.id).not.toBe(s.user.id);
  });

  it('a block stops messages both ways and hides the thread from the blocker', async () => {
    const shop = await seller();
    const buyer = await signIn(auth);
    const { id } = await messaging.start(
      { vendorSlug: shop.vendorSlug, productSlug: shop.listingSlug, body: 'Ainda disponível?' },
      buyer.sessionToken,
    );

    await messaging.block(id, shop.sessionToken); // the seller blocks the buyer
    await expect(messaging.send(id, 'Olá?', buyer.sessionToken)).rejects.toMatchObject({
      code: 'blocked',
    });
    await expect(
      messaging.start({ vendorSlug: shop.vendorSlug, body: 'Outra vez' }, buyer.sessionToken),
    ).rejects.toMatchObject({ code: 'blocked' });
    expect((await messaging.list(shop.sessionToken)).items.map((c) => c.id)).not.toContain(id);

    await messaging.unblock(id, shop.sessionToken);
    await expect(messaging.send(id, 'Sim, está.', shop.sessionToken)).resolves.toEqual({
      ok: true,
    });
    const inbox = await messaging.list(buyer.sessionToken);
    expect(inbox.items.find((c) => c.id === id)).toMatchObject({
      unread: 1,
      lastMessage: 'Sim, está.',
    });
  });
});

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appUser } from '../../db/schema/identity.js';
import { category } from '../../db/schema/catalog.js';
import type { Db } from '../../db/types.js';
import { hasTestDb, migrateTestDb, openTestDb } from '../../test/pg.js';
import { signIn } from '../../test/session.js';
import { AuthService } from '../auth/auth.service.js';
import { CatalogService } from './catalog.service.js';

// P0-02: no anonymous listings; a daily ceiling per shop.
describe.skipIf(!hasTestDb)('CatalogService.createListing (Postgres)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let auth: AuthService;
  let catalog: CatalogService;
  const slug = `teste-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    migrateTestDb();
    ({ db, close } = openTestDb());
    auth = new AuthService(db);
    const media = { storeDataUrl: () => Promise.resolve(randomUUID()) };
    const none = {} as never;
    catalog = new CatalogService(db, media as never, auth, none, none);
    await db.insert(category).values({
      id: randomUUID(),
      slug,
      namePt: 'Teste',
      nameEn: 'Test',
      level: 1,
    });
    process.env['LISTINGS_PER_DAY'] = '3';
  });
  afterAll(async () => {
    delete process.env['LISTINGS_PER_DAY'];
    await close();
  });

  const listing = (title: string) => ({
    title,
    categorySlug: slug,
    priceCents: 100_00,
    photos: [],
  });

  it('refuses a listing without a session', async () => {
    await expect(catalog.createListing(listing('Sem conta'), null)).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      catalog.createListing(listing('Sessão falsa'), 'not-a-token'),
    ).rejects.toMatchObject({
      status: 401,
    });
  });

  it('publishes under the seller’s own shop and stops at the daily limit', async () => {
    const { sessionToken } = await signIn(auth);
    for (let i = 1; i <= 3; i++) {
      await expect(
        catalog.createListing({ ...listing(`Anúncio ${i}`), shopName: 'Loja Teste' }, sessionToken),
      ).resolves.toMatchObject({ slug: expect.any(String) });
    }
    await expect(catalog.createListing(listing('Quarto'), sessionToken)).rejects.toMatchObject({
      status: 429,
    });
  });

  // AUTH-10: buyers reach sellers by phone, so an account opened with Google or
  // Facebook must confirm a number before its first listing.
  it('asks an account without a phone to confirm one, then publishes', async () => {
    const userId = randomUUID();
    await db.insert(appUser).values({ id: userId, phoneE164: null, displayName: 'Ana' });
    const session = await auth.issueSession({
      id: userId,
      phoneE164: null,
      displayName: 'Ana',
      email: null,
      phoneVerified: false,
      providers: ['google'],
    });
    await expect(
      catalog.createListing(listing('Sem número'), session.sessionToken),
    ).rejects.toMatchObject({ status: 403, response: { code: 'phone_required' } });

    const phone = `84${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
    const { challengeId, devCode } = await auth.requestPhoneLink(session.sessionToken, phone);
    await auth.verifyPhoneLink(session.sessionToken, challengeId, devCode ?? '');
    await expect(
      catalog.createListing(listing('Com número'), session.sessionToken),
    ).resolves.toMatchObject({ slug: expect.any(String) });
  });
});

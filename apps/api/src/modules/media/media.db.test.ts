import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import type { Db } from '../../db/types.js';
import { hasTestDb, migrateTestDb, openTestDb } from '../../test/pg.js';
import { MediaService } from './media.service.js';
import type { ObjectStore } from './object-store.js';

class MemoryStore implements ObjectStore {
  readonly objects = new Map<string, { bytes: Buffer; type: string }>();
  put(key: string, bytes: Buffer, type: string): Promise<void> {
    this.objects.set(key, { bytes, type });
    return Promise.resolve();
  }
  get(key: string): Promise<Buffer | null> {
    return Promise.resolve(this.objects.get(key)?.bytes ?? null);
  }
}

async function photo(): Promise<string> {
  const png = await sharp({
    create: { width: 40, height: 30, channels: 3, background: { r: 0, g: 122, b: 94 } },
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

// P1-03: photos go to object storage; Postgres keeps only the key.
describe.skipIf(!hasTestDb)('MediaService with object storage (Postgres)', () => {
  let db: Db;
  let close: () => Promise<void>;
  beforeAll(() => {
    migrateTestDb();
    ({ db, close } = openTestDb());
  });
  afterAll(async () => {
    delete process.env['MEDIA_CDN_URL'];
    await close();
  });

  it('stores the bytes in the bucket and reads them back', async () => {
    const store = new MemoryStore();
    const media = new MediaService(db, store);
    const id = await media.storeDataUrl(await photo());
    expect([...store.objects.keys()]).toEqual([`media/${id}.webp`]);
    const got = await media.get(id);
    expect(got?.contentType).toBe('image/webp');
    expect(got?.bytes.equals(store.objects.get(`media/${id}.webp`)!.bytes)).toBe(true);
  });

  it('points at the CDN when one is configured', async () => {
    process.env['MEDIA_CDN_URL'] = 'https://media.example.net/';
    const media = new MediaService(db, new MemoryStore());
    const id = await media.storeDataUrl(await photo());
    expect(await media.cdnUrl(id)).toBe(`https://media.example.net/media/${id}.webp`);
  });

  it('still serves photos kept in Postgres, and ignores bad ids', async () => {
    const media = new MediaService(db, null);
    const id = await media.storeDataUrl(await photo());
    expect((await media.get(id))?.bytes.length).toBeGreaterThan(0);
    expect(await media.cdnUrl(id)).toBeNull();
    expect(await media.get('not-a-uuid')).toBeNull();
  });
});

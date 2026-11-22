import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { mediaAsset } from '../../db/schema/media.js';

export class MediaError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_input' | 'too_large',
  ) {
    super(message);
    this.name = 'MediaError';
  }
}

// ~3 MB of base64 (~2.2 MB binary). Browser-compressed photos are far smaller;
// this is just a guard against an oversized paste.
const MAX_B64 = 3_000_000;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
// Decompression-bomb guard: refuse images above ~40 megapixels before decoding.
const MAX_INPUT_PIXELS = 40_000_000;
// Stored photos are scaled down to fit this box.
const MAX_EDGE = 1600;

/** The real type from the file's first bytes, whatever the data URL claims. */
export function sniffImageType(b: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    b.length >= 12 &&
    b.subarray(0, 4).toString('ascii') === 'RIFF' &&
    b.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/**
 * Decode and re-encode a photo (SEC-07): proves it is a real image, applies the
 * EXIF orientation, caps its size and drops all metadata (EXIF, GPS, camera
 * serials), which sharp does not copy unless asked to.
 */
export async function sanitiseImage(
  bytes: Buffer,
): Promise<{ contentType: string; bytes: Buffer }> {
  if (sniffImageType(bytes) === null) throw new MediaError('not an image', 'invalid_input');
  try {
    const out = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return { contentType: 'image/webp', bytes: out };
  } catch {
    throw new MediaError('unreadable image', 'invalid_input');
  }
}

@Injectable()
export class MediaService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Store a `data:<type>;base64,<payload>` string; returns the new asset id. */
  async storeDataUrl(dataUrl: string): Promise<string> {
    const m = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
    const contentType = m?.[1]?.toLowerCase();
    const payload = m?.[2];
    if (!contentType || !payload) throw new MediaError('not a base64 data URL', 'invalid_input');
    if (!ALLOWED.has(contentType)) throw new MediaError('unsupported image type', 'invalid_input');
    if (payload.length > MAX_B64) throw new MediaError('image too large', 'too_large');
    const clean = await sanitiseImage(Buffer.from(payload, 'base64'));
    const id = randomUUID();
    await this.db.insert(mediaAsset).values({
      id,
      contentType: clean.contentType,
      dataBase64: clean.bytes.toString('base64'),
    });
    return id;
  }

  async get(id: string): Promise<{ contentType: string; bytes: Buffer } | null> {
    const row = (
      await this.db
        .select({ contentType: mediaAsset.contentType, dataBase64: mediaAsset.dataBase64 })
        .from(mediaAsset)
        .where(eq(mediaAsset.id, id))
        .limit(1)
    )[0];
    if (!row) return null;
    return { contentType: row.contentType, bytes: Buffer.from(row.dataBase64, 'base64') };
  }
}

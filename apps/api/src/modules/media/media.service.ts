import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
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
    const id = randomUUID();
    await this.db.insert(mediaAsset).values({ id, contentType, dataBase64: payload });
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

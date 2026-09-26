import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { adCampaign } from '../../db/schema/ads.js';

export class AdError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_input' | 'not_found',
  ) {
    super(message);
    this.name = 'AdError';
  }
}

export type Placement = 'leaderboard' | 'mpu' | 'inline';
const PLACEMENTS: readonly Placement[] = ['leaderboard', 'mpu', 'inline'];

export interface ServedAd {
  id: string;
  imageUrl: string;
  clickUrl: string;
  headline: string | null;
  advertiser: string;
}
export interface BookInput {
  advertiserName: string;
  advertiserContact?: string;
  imageUrl: string;
  clickUrl: string;
  headline?: string;
  placement: Placement;
  categorySlug?: string;
  days: number;
}
export interface CampaignAdmin {
  id: string;
  advertiserName: string;
  placement: string;
  categorySlug: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  priceCents: number;
  impressions: number;
  clicks: number;
}

// Example rate card (demo), cents per day, by placement.
const RATE_PER_DAY: Record<Placement, number> = {
  leaderboard: 50000, // 500 MT/day
  mpu: 30000, // 300 MT/day
  inline: 40000, // 400 MT/day
};

@Injectable()
export class AdsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Pick a live campaign for a slot (targeted to the category or untargeted),
   *  count an impression, and return the creative. Null → caller shows a house ad. */
  async serve(placement: string, categorySlug?: string): Promise<ServedAd | null> {
    if (!isPlacement(placement)) return null;
    const nowTs = new Date();
    const catCond =
      categorySlug && categorySlug.trim() !== ''
        ? or(isNull(adCampaign.categorySlug), eq(adCampaign.categorySlug, categorySlug))
        : isNull(adCampaign.categorySlug);

    const rows = await this.db
      .select({
        id: adCampaign.id,
        imageUrl: adCampaign.imageUrl,
        clickUrl: adCampaign.clickUrl,
        headline: adCampaign.headline,
        advertiser: adCampaign.advertiserName,
      })
      .from(adCampaign)
      .where(
        and(
          eq(adCampaign.status, 'active'),
          eq(adCampaign.placement, placement),
          lte(adCampaign.startsAt, nowTs),
          gte(adCampaign.endsAt, nowTs),
          catCond,
        ),
      );
    if (rows.length === 0) return null;
    // Prefer a category-targeted campaign over an untargeted one, then rotate.
    const chosen = rows[Math.floor(Math.random() * rows.length)]!;
    await this.db
      .update(adCampaign)
      .set({ impressions: sql`${adCampaign.impressions} + 1` })
      .where(eq(adCampaign.id, chosen.id));
    return chosen;
  }

  /** Count a click and return the destination URL (or null if unknown). */
  async recordClick(id: string): Promise<string | null> {
    const rows = await this.db
      .select({ clickUrl: adCampaign.clickUrl })
      .from(adCampaign)
      .where(eq(adCampaign.id, asUuidOrNil(id)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    await this.db
      .update(adCampaign)
      .set({ clicks: sql`${adCampaign.clicks} + 1` })
      .where(eq(adCampaign.id, asUuidOrNil(id)));
    return row.clickUrl;
  }

  /** Book a campaign (starts pending until paid/approved). Returns id + price. */
  async book(input: BookInput): Promise<{ id: string; priceCents: number }> {
    const name = (input.advertiserName ?? '').trim();
    const imageUrl = (input.imageUrl ?? '').trim();
    const clickUrl = (input.clickUrl ?? '').trim();
    if (name === '' || !isHttpUrl(imageUrl) || !isHttpUrl(clickUrl)) {
      throw new AdError('Nome, imagem (URL) e link (URL) são obrigatórios.', 'invalid_input');
    }
    if (!isPlacement(input.placement)) {
      throw new AdError('Espaço inválido.', 'invalid_input');
    }
    const days = Math.trunc(Number(input.days));
    if (!Number.isFinite(days) || days < 1 || days > 90) {
      throw new AdError('A duração deve ser de 1 a 90 dias.', 'invalid_input');
    }
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + days * 86_400_000);
    const priceCents = RATE_PER_DAY[input.placement] * days;
    const id = randomUUID();
    await this.db.insert(adCampaign).values({
      id,
      advertiserName: name,
      advertiserContact: input.advertiserContact?.trim() || null,
      imageUrl,
      clickUrl,
      headline: input.headline?.trim() || null,
      placement: input.placement,
      categorySlug: input.categorySlug?.trim() || null,
      startsAt,
      endsAt,
      priceCents,
      status: 'pending',
    });
    return { id, priceCents };
  }

  /** Activate a campaign (after payment/approval). */
  async activate(id: string): Promise<void> {
    const res = await this.db
      .update(adCampaign)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(adCampaign.id, asUuidOrNil(id)))
      .returning({ id: adCampaign.id });
    if (res.length === 0) throw new AdError('Campanha não encontrada.', 'not_found');
  }

  /** Admin-lite: all campaigns with their stats. */
  async listAdmin(): Promise<CampaignAdmin[]> {
    const rows = await this.db
      .select()
      .from(adCampaign)
      .orderBy(desc(adCampaign.createdAt))
      .limit(200);
    return rows.map((r) => ({
      id: r.id,
      advertiserName: r.advertiserName,
      placement: r.placement,
      categorySlug: r.categorySlug,
      status: r.status,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      priceCents: r.priceCents,
      impressions: r.impressions,
      clicks: r.clicks,
    }));
  }

  rateCard(): Record<Placement, number> {
    return RATE_PER_DAY;
  }
}

function isPlacement(v: string): v is Placement {
  return (PLACEMENTS as readonly string[]).includes(v);
}
function isHttpUrl(v: string): boolean {
  return /^https?:\/\/.+/i.test(v);
}
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
function asUuidOrNil(value: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : NIL_UUID;
}

import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import type { AppConfig } from '../../config/config.schema.js';
import { adCampaign } from '../../db/schema/ads.js';
import { PaymentProvidersService } from '../payments/providers.service.js';
import type { ProviderId } from '../payments/payment-provider.interface.js';

export class AdError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_input' | 'not_found' | 'unavailable',
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
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly providers: PaymentProvidersService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

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
        categorySlug: adCampaign.categorySlug,
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
    // Prefer a campaign targeted to this category over an untargeted one, then
    // rotate at random within the chosen tier.
    const targeted = rows.filter((r) => r.categorySlug !== null);
    const pool = targeted.length > 0 ? targeted : rows;
    const chosen = pool[Math.floor(Math.random() * pool.length)]!;
    await this.db
      .update(adCampaign)
      .set({ impressions: sql`${adCampaign.impressions} + 1` })
      .where(eq(adCampaign.id, chosen.id));
    return {
      id: chosen.id,
      imageUrl: chosen.imageUrl,
      clickUrl: chosen.clickUrl,
      headline: chosen.headline,
      advertiser: chosen.advertiser,
    };
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
    // Creative may be a hosted https image or an internal /path; the click-through
    // must be an external http(s) URL.
    if (name === '' || !isImageUrl(imageUrl) || !isHttpUrl(clickUrl)) {
      throw new AdError('Nome, imagem (URL) e link (URL) são obrigatórios.', 'invalid_input');
    }
    if (!isPlacement(input.placement)) {
      throw new AdError('Espaço inválido.', 'invalid_input');
    }
    if (
      isGamblingAd(name, input.headline ?? '', clickUrl) &&
      process.env['ADS_ALLOW_GAMBLING'] !== '1'
    ) {
      throw new AdError(
        'A Nhonga não aceita, por agora, publicidade de apostas ou jogos de fortuna.',
        'invalid_input',
      );
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

  /** Self-serve booking: validate the payment method, book, settle (mock) and
   *  activate. Returns a receipt. Real wallet billing is partnership-gated. */
  async bookAndPay(
    input: BookInput,
    paymentMethod: string,
  ): Promise<{ id: string; priceCents: number; status: string; endsAt: string }> {
    const method = paymentMethod as ProviderId;
    if (this.providers.get(method) === undefined) {
      throw new AdError('Método de pagamento inválido.', 'invalid_input');
    }
    if (this.config.get('paymentsMode', { infer: true }) !== 'mock') {
      throw new AdError('Os pagamentos de publicidade ainda não estão disponíveis.', 'unavailable');
    }
    const { id, priceCents } = await this.book(input);
    // Mock: settle immediately and go live.
    await this.activate(id);
    const days = Math.trunc(Number(input.days));
    const endsAt = new Date(Date.now() + days * 86_400_000).toISOString();
    return { id, priceCents, status: 'active', endsAt };
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
function isImageUrl(v: string): boolean {
  return /^https?:\/\/.+/i.test(v) || /^\/[^/].*/.test(v);
}
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
function asUuidOrNil(value: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : NIL_UUID;
}

/**
 * Gambling advertising (P0-17). Until a legal opinion sets the rules (age
 * gate, licence check, placement limits), betting and casino ads are refused.
 * ADS_ALLOW_GAMBLING=1 lifts this once those rules exist. A keyword check is
 * crude on purpose: it errs towards refusing, and a person reviews the rest.
 */
const GAMBLING =
  /(?<![\p{L}\p{N}])(apostas?|[\p{L}\p{N}]*bet(?:s|ting)?|casinos?|cassino|slots?|roleta|jackpot|lotaria|bookmakers?|placard)(?![\p{L}\p{N}])/iu;

export function isGamblingAd(...texts: string[]): boolean {
  return texts.some((t) => GAMBLING.test(t.replace(/[._/-]+/g, ' ')));
}

import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gte, sql } from 'drizzle-orm';
import { cents, formatMZN } from '@nhonga/shared';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import type { AppConfig } from '../../config/config.schema.js';
import { listingBanner, type BannerSpec } from '../../db/schema/banners.js';
import { product, productImage, productVariant, category } from '../../db/schema/catalog.js';
import { vendor, vendorUser } from '../../db/schema/vendors.js';
import { district } from '../../db/schema/identity.js';
import { wallet, walletTransaction } from '../../db/schema/wallet.js';
import { AuthService } from '../auth/auth.service.js';
import { MediaService } from '../media/media.service.js';
import { AnthropicProvider } from '../assistant/anthropic.provider.js';
import {
  PRESETS,
  PRESET_PALETTE,
  RATIOS,
  renderBanner,
  type BannerPreset,
  type BannerRatio,
} from './banner-render.js';

export class BannerError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_input' | 'not_found' | 'forbidden' | 'quota' | 'unauthenticated',
  ) {
    super(message);
    this.name = 'BannerError';
  }
}

export interface BannerVariant {
  id: string;
  svg: string;
  preset: BannerPreset;
  ratio: BannerRatio;
  spec: BannerSpec;
}

export interface QuotaView {
  used: number;
  limit: number;
  remaining: number;
  isPro: boolean;
  /** Points charged per generation once the free quota is spent (0 for Pro). */
  pointCost: number;
}

const VARIANTS_PER_REQUEST = 3;

// Art-director prompt. Claude writes only the copy + palette; it never sets the
// price (we pass the exact one) and must not invent facts.
const SYSTEM = `És diretor de arte do Nhonga, o mercado de classificados de Moçambique. A partir de um anúncio real, escreves texto curto, honesto e vendedor para um banner promocional.

Regras:
- Português de Moçambique, tom claro e apelativo, sem exageros ("o melhor do mundo", "100% garantido") nem promessas que não constam do anúncio.
- NÃO inventes marca, modelo, estado, medidas, garantias nem preços. O preço é fixo e é inserido pela plataforma — não o escrevas no texto.
- headline: gancho curto (máx. 28 caracteres). subheadline: apoio (máx. 48). cta: chamada curta (máx. 18, ex.: "Contacta já", "Vê mais").
- Dá ${VARIANTS_PER_REQUEST} variantes DISTINTAS entre si (ângulos diferentes).
- Cores em hex #rrggbb adequadas ao estilo pedido e com bom contraste (text legível sobre a foto/escurecido).

Responde SÓ com JSON válido, sem texto à volta:
{"variants":[{"headline":"…","subheadline":"…","cta":"…","bg":"#rrggbb","accent":"#rrggbb","text":"#rrggbb"}]}`;

@Injectable()
export class BannersService {
  private readonly log = new Logger(BannersService.name);
  private readonly provider: AnthropicProvider | null;
  private readonly freeQuota: number;
  private readonly pointCost: number;
  /** spec cache keyed by input hash — avoids a Claude call for identical inputs. */
  private readonly specCache = new Map<string, BannerSpec[]>();

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly auth: AuthService,
    private readonly media: MediaService,
    config: ConfigService<AppConfig, true>,
  ) {
    const key = config.get('assistantApiKey', { infer: true });
    const model = config.get('assistantModel', { infer: true });
    this.provider = key ? new AnthropicProvider(key, model, 600) : null;
    this.freeQuota = config.get('bannerFreeQuota', { infer: true });
    this.pointCost = config.get('bannerPointCost', { infer: true });
  }

  async quota(token: string | null): Promise<QuotaView> {
    const v = await this.requireVendor(token);
    const isPro = await this.isPro(v.id);
    const used = await this.usedThisMonth(v.id);
    return {
      used,
      limit: this.freeQuota,
      remaining: isPro ? -1 : Math.max(0, this.freeQuota - used),
      isPro,
      pointCost: isPro ? 0 : this.pointCost,
    };
  }

  /** Generate (and persist) a set of banner variants for one owned listing. */
  async generate(
    token: string | null,
    input: {
      productId: string;
      ratio?: string;
      preset?: string;
      prompt?: string;
    },
  ): Promise<{ variants: BannerVariant[]; aiUsed: boolean; quota: QuotaView }> {
    const v = await this.requireVendor(token);
    const ratio = this.normRatio(input.ratio);
    const preset = this.normPreset(input.preset);
    const prompt = (input.prompt ?? '').trim().slice(0, 200);

    const p = await this.ownedProduct(v.id, input.productId);
    const isPro = await this.isPro(v.id);

    // Enforce the free monthly quota; beyond it, charge loyalty points (Pro is
    // unlimited and free of charge).
    if (!isPro) {
      const used = await this.usedThisMonth(v.id);
      if (used >= this.freeQuota) {
        await this.chargePoints(v.id);
      }
    }

    const { specs, aiUsed } = await this.artDirection(p, preset, prompt);
    const photoDataUri = await this.photoDataUri(p.productId);
    const watermarked = !isPro;
    const priceLabel = formatMZN(cents(p.priceCents));

    const variants: BannerVariant[] = [];
    for (const spec of specs.slice(0, VARIANTS_PER_REQUEST)) {
      const id = randomUUID();
      const svg = renderBanner({
        spec,
        preset,
        ratio,
        photoDataUri,
        priceLabel,
        categoryLabel: p.categoryName,
        location: p.location,
        watermarked,
      });
      await this.db.insert(listingBanner).values({
        id,
        productId: p.productId,
        vendorId: v.id,
        preset,
        ratio,
        spec,
        svg,
        watermarked,
      });
      variants.push({ id, svg, preset, ratio, spec });
    }

    return { variants, aiUsed, quota: await this.quota(token) };
  }

  /** Edit a generated banner's copy/preset and re-render it. Does not consume
   *  quota (it refines an existing banner rather than generating new ones). */
  async edit(
    token: string | null,
    bannerId: string,
    patch: { headline?: string; subheadline?: string; cta?: string; preset?: string },
  ): Promise<BannerVariant> {
    const v = await this.requireVendor(token);
    const row = (
      await this.db
        .select()
        .from(listingBanner)
        .where(eq(listingBanner.id, asUuid(bannerId)))
        .limit(1)
    )[0];
    if (!row) throw new BannerError('Banner não encontrado.', 'not_found');
    if (row.vendorId !== v.id) throw new BannerError('Sem permissão.', 'forbidden');

    const preset = patch.preset ? this.normPreset(patch.preset) : (row.preset as BannerPreset);
    const pal = PRESET_PALETTE[preset];
    // Keep the existing palette unless the preset changed (then adopt its palette).
    const presetChanged = preset !== row.preset;
    const spec: BannerSpec = {
      headline: clampText(patch.headline ?? row.spec.headline, 40),
      subheadline: clampText(patch.subheadline ?? row.spec.subheadline, 60),
      cta: clampText(patch.cta ?? row.spec.cta, 24) || 'Contacta já',
      bg: presetChanged ? pal.bg : row.spec.bg,
      accent: presetChanged ? pal.accent : row.spec.accent,
      text: presetChanged ? pal.text : row.spec.text,
    };

    const p = await this.ownedProduct(v.id, row.productId);
    const photoDataUri = await this.photoDataUri(p.productId);
    const svg = renderBanner({
      spec,
      preset,
      ratio: row.ratio as BannerRatio,
      photoDataUri,
      priceLabel: formatMZN(cents(p.priceCents)),
      categoryLabel: p.categoryName,
      location: p.location,
      watermarked: row.watermarked,
    });
    await this.db
      .update(listingBanner)
      .set({ spec, svg, preset })
      .where(eq(listingBanner.id, row.id));
    return { id: row.id, svg, preset, ratio: row.ratio as BannerRatio, spec };
  }

  /** Mark one generated banner as the listing's applied banner. */
  async apply(token: string | null, bannerId: string): Promise<{ bannerId: string }> {
    const v = await this.requireVendor(token);
    const b = (
      await this.db
        .select({ id: listingBanner.id, productId: listingBanner.productId, vendorId: listingBanner.vendorId })
        .from(listingBanner)
        .where(eq(listingBanner.id, asUuid(bannerId)))
        .limit(1)
    )[0];
    if (!b) throw new BannerError('Banner não encontrado.', 'not_found');
    if (b.vendorId !== v.id) throw new BannerError('Sem permissão.', 'forbidden');
    await this.db.update(product).set({ bannerId: b.id }).where(eq(product.id, b.productId));
    return { bannerId: b.id };
  }

  /** Remove the applied banner from a listing (owner only). */
  async unapply(token: string | null, productId: string): Promise<{ ok: true }> {
    const v = await this.requireVendor(token);
    const p = await this.ownedProduct(v.id, productId);
    await this.db.update(product).set({ bannerId: null }).where(eq(product.id, p.productId));
    return { ok: true };
  }

  /** Public: the SVG markup for one banner (served as image/svg+xml). */
  async svg(id: string): Promise<string | null> {
    const row = (
      await this.db
        .select({ svg: listingBanner.svg })
        .from(listingBanner)
        .where(eq(listingBanner.id, asUuid(id)))
        .limit(1)
    )[0];
    return row?.svg ?? null;
  }

  // ---- internals -----------------------------------------------------------

  private async artDirection(
    p: OwnedProduct,
    preset: BannerPreset,
    prompt: string,
  ): Promise<{ specs: BannerSpec[]; aiUsed: boolean }> {
    const pal = PRESET_PALETTE[preset];
    const key = createHash('sha1')
      .update(`${p.productId}|${preset}|${prompt}|${p.title}|${p.priceCents}`)
      .digest('hex');
    const cached = this.specCache.get(key);
    if (cached) return { specs: cached, aiUsed: true };

    const fallback = this.fallbackSpecs(p, pal);
    if (!this.provider) return { specs: fallback, aiUsed: false };

    const attrs = Object.entries(p.attributes)
      .slice(0, 6)
      .map(([k, val]) => `${k}: ${val}`)
      .join('; ');
    const user = [
      `Estilo do banner: ${preset}.`,
      `Paleta sugerida: fundo ${pal.bg}, destaque ${pal.accent}, texto ${pal.text}.`,
      `Categoria: ${p.categoryName}.`,
      `Título do anúncio: ${p.title}.`,
      p.description ? `Descrição: ${p.description.slice(0, 300)}.` : '',
      attrs ? `Detalhes: ${attrs}.` : '',
      p.location ? `Localização: ${p.location}.` : '',
      prompt ? `Pedido do vendedor: ${prompt}.` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const { text } = await this.provider.complete(SYSTEM, [{ role: 'user', content: user }]);
      const specs = parseSpecs(text, pal);
      if (specs.length === 0) return { specs: fallback, aiUsed: false };
      this.specCache.set(key, specs);
      return { specs, aiUsed: true };
    } catch (e) {
      this.log.warn(`art-direction failed, using fallback: ${e instanceof Error ? e.message : e}`);
      return { specs: fallback, aiUsed: false };
    }
  }

  private fallbackSpecs(
    p: OwnedProduct,
    pal: { bg: string; accent: string; text: string },
  ): BannerSpec[] {
    const title = p.title.slice(0, 28);
    const base: Omit<BannerSpec, 'headline'> = {
      subheadline: p.location ? `Disponível em ${p.location}` : 'Disponível agora',
      cta: 'Contacta já',
      bg: pal.bg,
      accent: pal.accent,
      text: pal.text,
    };
    return [
      { ...base, headline: title },
      { ...base, headline: 'À venda agora', subheadline: title.slice(0, 48) },
      { ...base, headline: p.categoryName, subheadline: title.slice(0, 48), cta: 'Vê mais' },
    ];
  }

  private async photoDataUri(productId: string): Promise<string | null> {
    const img = (
      await this.db
        .select({ s3Key: productImage.s3Key })
        .from(productImage)
        .where(eq(productImage.productId, productId))
        .orderBy(productImage.sortOrder)
        .limit(1)
    )[0];
    const key = img?.s3Key ?? '';

    // Seller-uploaded photo, held as a media asset.
    const mediaId = key.match(/^\/api\/media\/([0-9a-f-]{36})$/i)?.[1];
    if (mediaId) {
      const asset = await this.media.get(mediaId);
      return asset ? `data:${asset.contentType};base64,${asset.bytes.toString('base64')}` : null;
    }

    // Seed catalogue photos are hosted externally (Flickr/Openverse/Wikimedia).
    // Inline them so the SVG is self-contained. Restricted to https + a known
    // host allow-list (sellers cannot set these URLs, so this is only seed data).
    if (/^https:\/\//i.test(key) && isAllowedPhotoHost(key)) {
      return await fetchImageDataUri(key);
    }
    return null; // placeholder (/ph?...) — no real photo
  }

  private async ownedProduct(vendorId: string, productId: string): Promise<OwnedProduct> {
    const row = (
      await this.db
        .select({
          productId: product.id,
          vendorId: product.vendorId,
          title: product.titlePt,
          description: product.descriptionPt,
          attributes: product.attributes,
          categoryName: category.namePt,
          location: district.name,
        })
        .from(product)
        .innerJoin(category, eq(category.id, product.categoryId))
        .innerJoin(vendor, eq(vendor.id, product.vendorId))
        .leftJoin(district, eq(district.id, vendor.districtId))
        .where(eq(product.id, asUuid(productId)))
        .limit(1)
    )[0];
    if (!row) throw new BannerError('Anúncio não encontrado.', 'not_found');
    if (row.vendorId !== vendorId) throw new BannerError('Sem permissão.', 'forbidden');
    const priceRow = (
      await this.db
        .select({ price: productVariant.priceCents })
        .from(productVariant)
        .where(and(eq(productVariant.productId, row.productId), eq(productVariant.isActive, true)))
        .orderBy(productVariant.priceCents)
        .limit(1)
    )[0];
    return {
      productId: row.productId,
      title: row.title,
      description: row.description ?? '',
      attributes: row.attributes ?? {},
      priceCents: Number(priceRow?.price ?? 0),
      categoryName: row.categoryName,
      location: row.location ?? '',
    };
  }

  private async usedThisMonth(vendorId: string): Promise<number> {
    const start = new Date();
    const monthStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const rows = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(listingBanner)
      .where(and(eq(listingBanner.vendorId, vendorId), gte(listingBanner.createdAt, monthStart)));
    // Each generation creates VARIANTS_PER_REQUEST rows; count requests, not rows.
    return Math.ceil((rows[0]?.n ?? 0) / VARIANTS_PER_REQUEST);
  }

  private async isPro(vendorId: string): Promise<boolean> {
    const v = (
      await this.db.select({ proUntil: vendor.proUntil }).from(vendor).where(eq(vendor.id, vendorId))
    )[0];
    return v?.proUntil != null && v.proUntil.getTime() > Date.now();
  }

  private async chargePoints(vendorId: string): Promise<void> {
    await this.db.insert(wallet).values({ vendorId }).onConflictDoNothing();
    const w = (await this.db.select().from(wallet).where(eq(wallet.vendorId, vendorId)))[0];
    if ((w?.points ?? 0) < this.pointCost) {
      throw new BannerError(
        `Sem pontos suficientes. Cada banner extra custa ${this.pointCost} pontos este mês. Faz Loja Pro para gerar sem limites.`,
        'quota',
      );
    }
    await this.db
      .update(wallet)
      .set({ points: sql`${wallet.points} - ${this.pointCost}`, updatedAt: sql`now()` })
      .where(eq(wallet.vendorId, vendorId));
    await this.db.insert(walletTransaction).values({
      id: randomUUID(),
      vendorId,
      kind: 'purchase',
      amountCents: 0,
      points: -this.pointCost,
      description: 'Banner IA (extra)',
    });
  }

  private normRatio(r?: string): BannerRatio {
    return r && r in RATIOS ? (r as BannerRatio) : 'square';
  }

  private normPreset(p?: string): BannerPreset {
    return p && (PRESETS as readonly string[]).includes(p) ? (p as BannerPreset) : 'moderno';
  }

  private async requireVendor(token: string | null): Promise<{ id: string }> {
    if (!token) throw new BannerError('Inicie sessão.', 'unauthenticated');
    let userId: string;
    try {
      userId = (await this.auth.me(token)).id;
    } catch {
      throw new BannerError('Sessão inválida.', 'unauthenticated');
    }
    const row = (
      await this.db
        .select({ id: vendor.id })
        .from(vendorUser)
        .innerJoin(vendor, eq(vendor.id, vendorUser.vendorId))
        .where(eq(vendorUser.userId, userId))
        .limit(1)
    )[0];
    if (!row) throw new BannerError('Abra uma loja para gerar banners.', 'forbidden');
    return row;
  }
}

interface OwnedProduct {
  productId: string;
  title: string;
  description: string;
  attributes: Record<string, string>;
  priceCents: number;
  categoryName: string;
  location: string;
}

function asUuid(v: string): string {
  return /^[0-9a-f-]{36}$/i.test(v) ? v : '00000000-0000-0000-0000-000000000000';
}

/** Trim a seller-edited field to a safe length. */
function clampText(s: string, max: number): string {
  return (s ?? '').trim().slice(0, max);
}

// Hosts whose images the seed references. External fetch is limited to these so
// the inliner can never be pointed at an internal address.
const PHOTO_HOSTS = [
  'staticflickr.com',
  'live.staticflickr.com',
  'upload.wikimedia.org',
  'openverse.org',
  'wordpress.org',
  'mccdn.openverse.engineering',
];

function isAllowedPhotoHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PHOTO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Fetch an external image and return it as a base64 data URI (null on failure). */
async function fetchImageDataUri(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4_000_000) return null; // keep the SVG light
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Parse the model's JSON into validated specs; tolerant of code fences. */
function parseSpecs(text: string, pal: { bg: string; accent: string; text: string }): BannerSpec[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    return [];
  }
  const arr = (raw as { variants?: unknown }).variants;
  if (!Array.isArray(arr)) return [];
  const out: BannerSpec[] = [];
  for (const v of arr) {
    const o = v as Record<string, unknown>;
    const h = o['headline'];
    const sub = o['subheadline'];
    const cta = o['cta'];
    const bg = o['bg'];
    const accent = o['accent'];
    const text = o['text'];
    const headline = typeof h === 'string' ? h.trim().slice(0, 40) : '';
    if (!headline) continue;
    out.push({
      headline,
      subheadline: typeof sub === 'string' ? sub.trim().slice(0, 60) : '',
      cta: typeof cta === 'string' && cta.trim() ? cta.trim().slice(0, 24) : 'Contacta já',
      bg: typeof bg === 'string' && HEX.test(bg.trim()) ? bg.trim() : pal.bg,
      accent: typeof accent === 'string' && HEX.test(accent.trim()) ? accent.trim() : pal.accent,
      text: typeof text === 'string' && HEX.test(text.trim()) ? text.trim() : pal.text,
    });
  }
  return out;
}

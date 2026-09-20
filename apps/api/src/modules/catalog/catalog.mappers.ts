import type {
  ImageDto,
  Lang,
  OptionGroup,
  ProductListItem,
  ProductVariantDto,
} from './catalog.types.js';

/** Pure, testable mapping helpers shared by list and detail. */

export function pickText(pt: string, en: string | null, lang: Lang): string {
  if (lang === 'en' && en !== null && en.trim() !== '') return en;
  return pt;
}

export function discountPercent(priceCents: number, compareAtCents: number | null): number | null {
  if (compareAtCents === null || compareAtCents <= priceCents) return null;
  return Math.round((1 - priceCents / compareAtCents) * 100);
}

export interface VariantRow {
  readonly id: string;
  readonly sku: string;
  readonly options: Record<string, string>;
  readonly priceCents: number;
  readonly compareAtCents: number | null;
  readonly stockQuantity: number;
  readonly isActive: boolean;
}

export interface ImageRow {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly lqip: string | null;
  readonly altText: string | null;
}

export function toImageDto(row: ImageRow): ImageDto {
  return {
    url: row.url,
    width: row.width,
    height: row.height,
    ...(row.lqip ? { lqip: row.lqip } : {}),
    ...(row.altText ? { alt: row.altText } : {}),
  };
}

export function toVariantDto(v: VariantRow): ProductVariantDto {
  return {
    id: v.id,
    sku: v.sku,
    options: v.options,
    priceCents: v.priceCents,
    ...(v.compareAtCents !== null ? { compareAtCents: v.compareAtCents } : {}),
    // Exact below the low-stock threshold is a client concern; the buyer only
    // needs to know it is buyable here.
    stockQuantity: v.stockQuantity,
    inStock: v.stockQuantity > 0,
  };
}

/**
 * The cheapest active, in-stock-preferred variant sets the product's headline
 * price. A grid price that does not match any buyable variant is a trust bug.
 */
export function headlineVariant(active: readonly VariantRow[]): VariantRow | undefined {
  if (active.length === 0) return undefined;
  const inStock = active.filter((v) => v.stockQuantity > 0);
  const pool = inStock.length > 0 ? inStock : active;
  return [...pool].sort((a, b) => a.priceCents - b.priceCents)[0];
}

/** Build the option-group selector from the variants' option maps. A value is
 *  available if any active, in-stock variant carries it. */
export function buildOptions(active: readonly VariantRow[]): OptionGroup[] {
  const groups = new Map<string, Map<string, boolean>>();
  for (const v of active) {
    const buyable = v.stockQuantity > 0;
    for (const [name, value] of Object.entries(v.options)) {
      if (!groups.has(name)) groups.set(name, new Map());
      const values = groups.get(name)!;
      values.set(value, (values.get(value) ?? false) || buyable);
    }
  }
  return [...groups.entries()].map(([name, values]) => ({
    name,
    values: [...values.entries()].map(([value, available]) => ({ value, available })),
  }));
}

export interface ListItemInput {
  readonly id: string;
  readonly slug: string;
  readonly titlePt: string;
  readonly titleEn: string | null;
  readonly ratingAvg: string | null; // numeric comes back as string from pg
  readonly ratingCount: number;
  readonly vendor: {
    id: string;
    slug: string;
    displayName: string;
    status: string;
    ratingAvg: string | null;
    ratingCount: number;
  };
  readonly variants: readonly VariantRow[];
  readonly primaryImage: ImageRow | null;
}

export function toListItem(input: ListItemInput, lang: Lang): ProductListItem {
  const active = input.variants.filter((v) => v.isActive);
  const head = headlineVariant(active);
  const price = head?.priceCents ?? 0;
  const compareAt = head?.compareAtCents ?? null;
  return {
    id: input.id,
    slug: input.slug,
    title: pickText(input.titlePt, input.titleEn, lang),
    priceCents: price,
    ...(compareAt !== null ? { compareAtCents: compareAt } : {}),
    discountPercent: discountPercent(price, compareAt),
    ...(input.primaryImage ? { image: toImageDto(input.primaryImage) } : {}),
    ratingAvg: input.ratingAvg === null ? null : Number(input.ratingAvg),
    ratingCount: input.ratingCount,
    inStock: active.some((v) => v.stockQuantity > 0),
    freeDelivery: false, // shipping logic is not built; never claim free delivery we cannot honour
    vendor: {
      id: input.vendor.id,
      slug: input.vendor.slug,
      displayName: input.vendor.displayName,
      isVerified: input.vendor.status === 'active',
      ratingAvg: input.vendor.ratingAvg === null ? null : Number(input.vendor.ratingAvg),
      ratingCount: input.vendor.ratingCount,
    },
  };
}

/** Response shapes for the catalog endpoints, matching openapi.yaml. */

export interface ImageDto {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly lqip?: string;
  readonly alt?: string;
}

export interface VendorSummaryDto {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly isVerified: boolean;
  /** Paid "Loja Pro" subscription active — the verified-shop selo. */
  readonly isPro: boolean;
  readonly ratingAvg: number | null;
  readonly ratingCount: number;
  /** Always null since PRIV-01: the numbers are returned only by
   *  POST /catalog/contacts. Kept so older clients do not break. */
  readonly whatsapp: string | null;
  readonly phone: string | null;
  /** Channels offered, without digits (PRIV-01). Detail and shop only. */
  readonly contact?: { whatsapp: boolean; phone: boolean; hint: string | null };
}

export interface ListingStats {
  readonly views: number;
  readonly contacts: number;
  readonly shares: number;
}

export interface ProductListItem {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly priceCents: number;
  readonly compareAtCents?: number;
  readonly discountPercent: number | null;
  readonly image?: ImageDto;
  readonly ratingAvg: number | null;
  readonly ratingCount: number;
  readonly inStock: boolean;
  readonly freeDelivery: boolean;
  /** Seller location (district), for the classifieds-style listing card. */
  readonly location: string | null;
  /** When the listing was published (ISO), for the "posted" line. */
  readonly postedAt: string | null;
  /** Paid-visibility: currently featured (Destaque). Ranked above the rest. */
  readonly featured: boolean;
  /** Public view count, for social-proof on cards. */
  readonly views: number;
  /** Applied AI banner SVG url, or null. Lets cards/storefront show the banner. */
  readonly bannerUrl: string | null;
  /** The listing category (slug + localized name), for per-vendor filtering. */
  readonly category: { readonly slug: string; readonly name: string };
  /** Typed attribute values (verticals), for the list-view summary line. */
  readonly attributes: Record<string, string>;
  readonly vendor: VendorSummaryDto;
}

export interface ProductVariantDto {
  readonly id: string;
  readonly sku: string;
  readonly options: Record<string, string>;
  readonly priceCents: number;
  readonly compareAtCents?: number;
  readonly stockQuantity: number;
  readonly inStock: boolean;
}

export interface OptionGroup {
  readonly name: string;
  readonly values: ReadonlyArray<{ value: string; available: boolean }>;
}

export interface ProductDetail extends ProductListItem {
  /** The listing's category — drives per-vertical labels and call-to-actions. */
  readonly category: { readonly slug: string; readonly name: string };
  readonly description: string;
  readonly attributes: Record<string, string>;
  readonly images: readonly ImageDto[];
  readonly variants: readonly ProductVariantDto[];
  readonly options: readonly OptionGroup[];
  readonly stats: ListingStats;
}

export type SortKey = 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';

export interface CategoryAttributeDto {
  readonly key: string;
  readonly label: string;
  readonly dataType: 'text' | 'number' | 'boolean' | 'enum';
  readonly options: string[] | null;
}

/** A per-attribute filter: an exact value (text/enum/boolean) or a numeric range. */
export type AttributeFilter = string | { min?: number; max?: number };

export interface ProductFilters {
  readonly q?: string;
  readonly categorySlug?: string;
  readonly vendorSlug?: string;
  /** Province code (vendor's district → province), for location search. */
  readonly province?: string;
  /** District id (vendor's district), for the finer location filter. */
  readonly district?: string;
  readonly minPriceCents?: number;
  readonly maxPriceCents?: number;
  readonly inStockOnly?: boolean;
  readonly attributes?: Record<string, AttributeFilter>;
  readonly sort?: SortKey;
  readonly limit?: number;
  /** Opaque cursor from a previous page's page.cursor. */
  readonly cursor?: string;
}

export interface ProductListResponse {
  readonly total: number;
  readonly items: readonly ProductListItem[];
  readonly page: { readonly cursor: string | null; readonly hasMore: boolean };
  /**
   * Set when the query had no matches as typed and was re-run with spelling
   * corrections ("toyta" → "toyota"). The UI shows "A mostrar resultados para …".
   */
  readonly correctedQuery?: string | null;
  /**
   * Matches per category for the current query and location, ignoring the
   * category filter itself, so the UI can offer "Viaturas (5) · Imóveis (2)"
   * chips to narrow down. Only computed when a text query is present.
   */
  readonly categoryCounts?: ReadonlyArray<{
    readonly slug: string;
    readonly name: string;
    readonly count: number;
  }>;
}

export type Lang = 'pt' | 'en';

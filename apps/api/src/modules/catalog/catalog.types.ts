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
  readonly ratingAvg: number | null;
  readonly ratingCount: number;
  /** Classifieds contact — null when the seller hides the channel or has no
   *  number. E.164 (2588…). Only populated on the product detail. */
  readonly whatsapp: string | null;
  readonly phone: string | null;
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
  readonly minPriceCents?: number;
  readonly maxPriceCents?: number;
  readonly inStockOnly?: boolean;
  readonly attributes?: Record<string, AttributeFilter>;
  readonly sort?: SortKey;
  readonly limit?: number;
}

export interface ProductListResponse {
  readonly total: number;
  readonly items: readonly ProductListItem[];
  readonly page: { readonly cursor: string | null; readonly hasMore: boolean };
}

export type Lang = 'pt' | 'en';

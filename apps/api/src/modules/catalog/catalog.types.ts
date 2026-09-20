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
}

export interface ProductListResponse {
  readonly items: readonly ProductListItem[];
  readonly page: { readonly cursor: string | null; readonly hasMore: boolean };
}

export type Lang = 'pt' | 'en';

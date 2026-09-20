import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import { category, product, productImage, productVariant } from '../../db/schema/catalog.js';
import { vendor } from '../../db/schema/vendors.js';
import type { Db } from '../../db/types.js';
import {
  buildOptions,
  headlineVariant,
  pickText,
  toImageDto,
  toListItem,
  toVariantDto,
  type ImageRow,
  type VariantRow,
} from './catalog.mappers.js';
import type {
  Lang,
  ProductDetail,
  ProductFilters,
  ProductListItem,
  ProductListResponse,
  SortKey,
} from './catalog.types.js';

@Injectable()
export class CatalogService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Browse published products. Kept intentionally simple for the read slice:
   *  no OpenSearch, no facets - a straight Postgres query behind the contract's
   *  {items, page} envelope. */
  /**
   * Browse published products with filtering and sorting behind the contract's
   * {items, page, total} envelope. Category, vendor and free-text filters run
   * in SQL; price, stock and sort are applied to the mapped list items because
   * the headline price is derived from the cheapest in-stock variant. At real
   * scale this moves to OpenSearch (D-09); the behaviour and shape are the same.
   */
  async listProducts(lang: Lang, filters: ProductFilters = {}): Promise<ProductListResponse> {
    const limit = Math.min(Math.max(filters.limit ?? 24, 1), 48);

    const conds: SQL[] = [eq(product.status, 'active')];
    if (filters.categorySlug) conds.push(eq(category.slug, filters.categorySlug));
    if (filters.vendorSlug) conds.push(eq(vendor.slug, filters.vendorSlug));
    if (filters.q && filters.q.trim() !== '') {
      const needle = `%${filters.q.trim()}%`;
      const m = or(ilike(product.titlePt, needle), ilike(product.titleEn, needle));
      if (m) conds.push(m);
    }

    const rows = await this.db
      .select({
        id: product.id,
        slug: product.slug,
        titlePt: product.titlePt,
        titleEn: product.titleEn,
        ratingAvg: product.ratingAvg,
        ratingCount: product.ratingCount,
        publishedAt: product.publishedAt,
        vId: vendor.id,
        vSlug: vendor.slug,
        vName: vendor.displayName,
        vStatus: vendor.status,
      })
      .from(product)
      .innerJoin(vendor, eq(product.vendorId, vendor.id))
      .innerJoin(category, eq(product.categoryId, category.id))
      .where(and(...conds));

    const ids = rows.map((p) => p.id);
    const variantsByProduct = await this.variantsFor(ids);
    const imagesByProduct = await this.primaryImageFor(ids);

    // Preserve publishedAt alongside the mapped item for the "newest" sort.
    let mapped = rows.map((p) => ({
      item: toListItem(
        {
          id: p.id,
          slug: p.slug,
          titlePt: p.titlePt,
          titleEn: p.titleEn,
          ratingAvg: p.ratingAvg,
          ratingCount: p.ratingCount,
          vendor: {
            id: p.vId,
            slug: p.vSlug,
            displayName: p.vName,
            status: p.vStatus,
            ratingAvg: null,
            ratingCount: 0,
          },
          variants: variantsByProduct.get(p.id) ?? [],
          primaryImage: imagesByProduct.get(p.id) ?? null,
        },
        lang,
      ),
      publishedAt: p.publishedAt,
    }));

    if (filters.inStockOnly) mapped = mapped.filter((m) => m.item.inStock);
    if (filters.minPriceCents !== undefined)
      mapped = mapped.filter((m) => m.item.priceCents >= filters.minPriceCents!);
    if (filters.maxPriceCents !== undefined)
      mapped = mapped.filter((m) => m.item.priceCents <= filters.maxPriceCents!);

    mapped.sort(sorter(filters.sort ?? 'relevance'));

    const total = mapped.length;
    const page = mapped.slice(0, limit).map((m) => m.item);
    return { total, items: page, page: { cursor: null, hasMore: total > limit } };
  }

  /** Full detail by UUID or slug. */
  async getProduct(idOrSlug: string, lang: Lang): Promise<ProductDetail> {
    const rows = await this.db
      .select({
        id: product.id,
        slug: product.slug,
        titlePt: product.titlePt,
        titleEn: product.titleEn,
        descPt: product.descriptionPt,
        descEn: product.descriptionEn,
        attributes: product.attributes,
        ratingAvg: product.ratingAvg,
        ratingCount: product.ratingCount,
        vId: vendor.id,
        vSlug: vendor.slug,
        vName: vendor.displayName,
        vStatus: vendor.status,
      })
      .from(product)
      .innerJoin(vendor, eq(product.vendorId, vendor.id))
      .where(
        and(
          eq(product.status, 'active'),
          or(eq(product.slug, idOrSlug), eq(product.id, asUuidOrNil(idOrSlug))),
        ),
      )
      .limit(1);

    const p = rows[0];
    if (p === undefined)
      throw new NotFoundException({ error: 'Not Found', message: 'No such product' });

    const variants = (await this.variantsFor([p.id])).get(p.id) ?? [];
    const images = await this.allImagesFor(p.id);

    const base = toListItem(
      {
        id: p.id,
        slug: p.slug,
        titlePt: p.titlePt,
        titleEn: p.titleEn,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        vendor: {
          id: p.vId,
          slug: p.vSlug,
          displayName: p.vName,
          status: p.vStatus,
          ratingAvg: null,
          ratingCount: 0,
        },
        variants,
        primaryImage: images[0] ?? null,
      },
      lang,
    );

    const active = variants.filter((v) => v.isActive);
    void headlineVariant(active); // headline price already set on base

    return {
      ...base,
      description: pickText(p.descPt ?? '', p.descEn, lang),
      attributes: p.attributes,
      images: images.map(toImageDto),
      variants: active.map(toVariantDto),
      options: buildOptions(active),
    };
  }

  private async variantsFor(productIds: string[]): Promise<Map<string, VariantRow[]>> {
    const map = new Map<string, VariantRow[]>();
    if (productIds.length === 0) return map;
    const rows = await this.db
      .select({
        productId: productVariant.productId,
        id: productVariant.id,
        sku: productVariant.sku,
        options: productVariant.options,
        priceCents: productVariant.priceCents,
        compareAtCents: productVariant.compareAtCents,
        stockQuantity: productVariant.stockQuantity,
        isActive: productVariant.isActive,
      })
      .from(productVariant)
      .where(inArray(productVariant.productId, productIds));
    for (const r of rows) {
      const { productId, ...v } = r;
      if (!map.has(productId)) map.set(productId, []);
      map.get(productId)!.push(v);
    }
    return map;
  }

  private async primaryImageFor(productIds: string[]): Promise<Map<string, ImageRow>> {
    const map = new Map<string, ImageRow>();
    if (productIds.length === 0) return map;
    const rows = await this.db
      .select({
        productId: productImage.productId,
        url: productImage.s3Key,
        width: productImage.width,
        height: productImage.height,
        lqip: productImage.lqip,
        altText: productImage.altText,
      })
      .from(productImage)
      .where(inArray(productImage.productId, productIds))
      .orderBy(asc(productImage.sortOrder));
    for (const r of rows) {
      if (!map.has(r.productId)) {
        const { productId, ...img } = r;
        map.set(productId, img);
      }
    }
    return map;
  }

  private async allImagesFor(productId: string): Promise<ImageRow[]> {
    const rows = await this.db
      .select({
        url: productImage.s3Key,
        width: productImage.width,
        height: productImage.height,
        lqip: productImage.lqip,
        altText: productImage.altText,
      })
      .from(productImage)
      .where(eq(productImage.productId, productId))
      .orderBy(asc(productImage.sortOrder));
    return rows;
  }
}

type Sortable = { item: ProductListItem; publishedAt: Date | null };

/** Comparator per sort key. relevance keeps the SQL order (stable). */
function sorter(key: SortKey): (a: Sortable, b: Sortable) => number {
  switch (key) {
    case 'price_asc':
      return (a, b) => a.item.priceCents - b.item.priceCents;
    case 'price_desc':
      return (a, b) => b.item.priceCents - a.item.priceCents;
    case 'rating':
      return (a, b) => (b.item.ratingAvg ?? 0) - (a.item.ratingAvg ?? 0);
    case 'newest':
      return (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
    default:
      return () => 0;
  }
}

/** Products may be addressed by slug or UUID. When the value is not a UUID, this
 *  returns a sentinel that cannot match any id, so the slug branch decides. */
function asUuidOrNil(value: string): string {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return UUID.test(value) ? value : '00000000-0000-0000-0000-000000000000';
}

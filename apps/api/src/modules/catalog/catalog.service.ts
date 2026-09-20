import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import { product, productImage, productVariant } from '../../db/schema/catalog.js';
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
  type ListItemInput,
  type VariantRow,
} from './catalog.mappers.js';
import type { Lang, ProductDetail, ProductListItem, ProductListResponse } from './catalog.types.js';

@Injectable()
export class CatalogService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Browse published products. Kept intentionally simple for the read slice:
   *  no OpenSearch, no facets - a straight Postgres query behind the contract's
   *  {items, page} envelope. */
  async listProducts(lang: Lang, limit = 24): Promise<ProductListResponse> {
    const products = await this.db
      .select({
        id: product.id,
        slug: product.slug,
        titlePt: product.titlePt,
        titleEn: product.titleEn,
        ratingAvg: product.ratingAvg,
        ratingCount: product.ratingCount,
        vId: vendor.id,
        vSlug: vendor.slug,
        vName: vendor.displayName,
        vStatus: vendor.status,
      })
      .from(product)
      .innerJoin(vendor, eq(product.vendorId, vendor.id))
      .where(eq(product.status, 'active'))
      .orderBy(asc(product.slug))
      .limit(limit + 1);

    const hasMore = products.length > limit;
    const page = products.slice(0, limit);
    const ids = page.map((p) => p.id);

    const variantsByProduct = await this.variantsFor(ids);
    const imagesByProduct = await this.primaryImageFor(ids);

    const items: ProductListItem[] = page.map((p) => {
      const input: ListItemInput = {
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
      };
      return toListItem(input, lang);
    });

    return { items, page: { cursor: null, hasMore } };
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

/** Products may be addressed by slug or UUID. When the value is not a UUID, this
 *  returns a sentinel that cannot match any id, so the slug branch decides. */
function asUuidOrNil(value: string): string {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return UUID.test(value) ? value : '00000000-0000-0000-0000-000000000000';
}

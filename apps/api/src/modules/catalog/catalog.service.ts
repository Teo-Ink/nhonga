import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import { listingReport } from '../../db/schema/reports.js';
import {
  category,
  categoryAttribute,
  product,
  productImage,
  productVariant,
} from '../../db/schema/catalog.js';
import { vendor, vendorUser } from '../../db/schema/vendors.js';
import { district } from '../../db/schema/identity.js';
import { MediaService } from '../media/media.service.js';
import { AuthService, type AuthUser } from '../auth/auth.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { Db } from '../../db/types.js';
import {
  buildOptions,
  headlineVariant,
  pickText,
  sellerContact,
  toImageDto,
  toListItem,
  toVariantDto,
  type ImageRow,
  type VariantRow,
} from './catalog.mappers.js';
import type {
  CategoryAttributeDto,
  Lang,
  ProductDetail,
  ProductFilters,
  ProductListItem,
  ProductListResponse,
  SortKey,
} from './catalog.types.js';

/** Allowed listing-report reasons (trust & safety). */
export const REPORT_REASONS = [
  'fraud',
  'prohibited',
  'spam',
  'wrong_category',
  'offensive',
  'other',
] as const;

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly media: MediaService,
    private readonly auth: AuthService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Create a listing from the seller form (G — real "Publicar"). No seller auth
   * in the demo, so listings attach to a shared "Anúncios da Comunidade" shop
   * that is created on first use. Photos are browser-compressed data URLs; each
   * is stored as a media asset and referenced by its /api/media URL.
   */
  async createListing(
    input: {
      title: string;
      categorySlug: string;
      description?: string;
      priceCents: number;
      stock?: number;
      photos?: string[];
      shopName?: string;
    },
    sessionToken?: string | null,
  ): Promise<{ id: string; slug: string }> {
    const title = input.title.trim();
    if (title.length < 3) throw new BadRequestException({ message: 'title too short' });
    if (!Number.isFinite(input.priceCents) || input.priceCents < 0) {
      throw new BadRequestException({ message: 'invalid price' });
    }

    const cat = (
      await this.db
        .select({ id: category.id })
        .from(category)
        .where(eq(category.slug, input.categorySlug))
        .limit(1)
    )[0];
    if (!cat) throw new BadRequestException({ message: 'unknown category' });

    // Signed-in seller → their own shop (created on first listing); otherwise
    // the shared community shop, so the demo works without an account.
    let vendorId: string;
    if (sessionToken) {
      try {
        const user = await this.auth.me(sessionToken);
        vendorId = await this.ensureUserVendor(user, input.shopName);
      } catch {
        vendorId = await this.ensureCommunityVendor();
      }
    } else {
      vendorId = await this.ensureCommunityVendor();
    }
    const slug = await this.uniqueSlug(title);
    const productId = randomUUID();

    await this.db.insert(product).values({
      id: productId,
      vendorId,
      categoryId: cat.id,
      slug,
      titlePt: title.slice(0, 140),
      titleEn: null,
      descriptionPt: (input.description ?? '').slice(0, 4000),
      attributes: {},
      status: 'active',
      publishedAt: new Date(),
    });

    await this.db.insert(productVariant).values({
      id: randomUUID(),
      productId,
      sku: `USR-${slug.slice(0, 20)}`.toUpperCase(),
      options: {},
      priceCents: Math.trunc(input.priceCents),
      stockQuantity: Number.isFinite(input.stock) ? Math.max(0, Math.trunc(input.stock!)) : 1,
      isActive: true,
    });

    const photos = (input.photos ?? []).slice(0, 6);
    let sort = 0;
    for (const dataUrl of photos) {
      try {
        const mediaId = await this.media.storeDataUrl(dataUrl);
        await this.db.insert(productImage).values({
          id: randomUUID(),
          productId,
          s3Key: `/api/media/${mediaId}`,
          width: 1024,
          height: 768,
          altText: title.slice(0, 140),
          sortOrder: sort++,
        });
      } catch {
        // Skip an unparseable/oversized photo rather than failing the listing.
      }
    }
    // No photo uploaded → a generated placeholder so cards still render.
    if (sort === 0) {
      await this.db.insert(productImage).values({
        id: randomUUID(),
        productId,
        s3Key: `/ph?t=${encodeURIComponent(title)}`,
        width: 640,
        height: 480,
        altText: title.slice(0, 140),
        sortOrder: 0,
      });
    }

    return { id: productId, slug };
  }

  /** The vendor ids the signed-in user owns/manages (for ownership checks). */
  private async userVendorIds(sessionToken: string | null): Promise<string[]> {
    if (!sessionToken) return [];
    let user: AuthUser;
    try {
      user = await this.auth.me(sessionToken);
    } catch {
      return [];
    }
    const rows = await this.db
      .select({ vendorId: vendorUser.vendorId })
      .from(vendorUser)
      .where(eq(vendorUser.userId, user.id));
    return rows.map((r) => r.vendorId);
  }

  /** Public shop detail: header, trust signals, contact and simple stats. */
  async getShop(slug: string): Promise<{
    slug: string;
    displayName: string;
    isVerified: boolean;
    isPro: boolean;
    ratingAvg: number | null;
    ratingCount: number;
    location: string | null;
    memberSince: string;
    activeCount: number;
    soldCount: number;
    whatsapp: string | null;
    phone: string | null;
  } | null> {
    const v = (
      await this.db
        .select({
          id: vendor.id,
          slug: vendor.slug,
          name: vendor.displayName,
          status: vendor.status,
          proUntil: vendor.proUntil,
          ratingAvg: vendor.ratingAvg,
          ratingCount: vendor.ratingCount,
          createdAt: vendor.createdAt,
          whatsapp: vendor.whatsapp,
          contactPhone: vendor.contactPhone,
          showWhatsapp: vendor.showWhatsapp,
          showPhone: vendor.showPhone,
          districtName: district.name,
        })
        .from(vendor)
        .leftJoin(district, eq(vendor.districtId, district.id))
        .where(eq(vendor.slug, slug))
        .limit(1)
    )[0];
    if (!v) return null;

    const counts = await this.db
      .select({ status: product.status, n: sql<number>`count(*)::int` })
      .from(product)
      .where(eq(product.vendorId, v.id))
      .groupBy(product.status);
    const activeCount = counts.find((c) => c.status === 'active')?.n ?? 0;
    const soldCount = counts.find((c) => c.status === 'sold')?.n ?? 0;
    const contact = sellerContact({
      whatsapp: v.whatsapp,
      contactPhone: v.contactPhone,
      showWhatsapp: v.showWhatsapp,
      showPhone: v.showPhone,
    });

    return {
      slug: v.slug,
      displayName: v.name,
      isVerified: v.status === 'active',
      isPro: v.proUntil !== null && v.proUntil.getTime() > Date.now(),
      ratingAvg: v.ratingAvg === null ? null : Number(v.ratingAvg),
      ratingCount: v.ratingCount,
      location: v.districtName,
      memberSince: v.createdAt.toISOString(),
      activeCount,
      soldCount,
      whatsapp: contact.whatsapp,
      phone: contact.phone,
    };
  }

  /** The signed-in seller's own listings — all statuses (active/sold/archived),
   *  for the "A minha loja" panel, so they can manage each one. */
  async mineProducts(
    sessionToken: string | null,
    lang: Lang,
  ): Promise<{
    shop: { slug: string; displayName: string } | null;
    stats: {
      active: number;
      sold: number;
      views: number;
      contacts: number;
      ratingAvg: number | null;
      ratingCount: number;
    };
    items: {
      id: string;
      slug: string;
      title: string;
      priceCents: number;
      imageUrl: string | null;
      status: string;
      inStock: boolean;
      views: number;
      contacts: number;
    }[];
  }> {
    const empty = {
      active: 0,
      sold: 0,
      views: 0,
      contacts: 0,
      ratingAvg: null as number | null,
      ratingCount: 0,
    };
    const shop = await this.myShop(sessionToken);
    const vids = await this.userVendorIds(sessionToken);
    if (!shop || vids.length === 0) return { shop, stats: empty, items: [] };

    const rows = await this.db
      .select({
        id: product.id,
        slug: product.slug,
        titlePt: product.titlePt,
        titleEn: product.titleEn,
        status: product.status,
        views: product.viewCount,
        contacts: product.contactCount,
      })
      .from(product)
      .where(
        and(
          inArray(product.vendorId, vids),
          inArray(product.status, ['active', 'sold', 'archived']),
        ),
      )
      .orderBy(desc(product.updatedAt));

    const ids = rows.map((r) => r.id);
    const variants = await this.variantsFor(ids);
    const images = await this.primaryImageFor(ids);
    const items = rows.map((r) => {
      const active = (variants.get(r.id) ?? []).filter((v) => v.isActive);
      const head = headlineVariant(active);
      return {
        id: r.id,
        slug: r.slug,
        title: pickText(r.titlePt, r.titleEn, lang),
        priceCents: head?.priceCents ?? 0,
        imageUrl: images.get(r.id)?.url ?? null,
        status: r.status,
        inStock: active.some((v) => v.stockQuantity > 0),
        views: r.views,
        contacts: r.contacts,
      };
    });

    const rating = (
      await this.db
        .select({ avg: vendor.ratingAvg, count: vendor.ratingCount })
        .from(vendor)
        .where(eq(vendor.id, vids[0]!))
        .limit(1)
    )[0];
    const stats = {
      active: rows.filter((r) => r.status === 'active').length,
      sold: rows.filter((r) => r.status === 'sold').length,
      views: rows.reduce((n, r) => n + (r.views ?? 0), 0),
      contacts: rows.reduce((n, r) => n + (r.contacts ?? 0), 0),
      ratingAvg: rating?.avg ? Number(rating.avg) : null,
      ratingCount: rating?.count ?? 0,
    };
    return { shop, stats, items };
  }

  /** Change one of the seller's listings between active / sold / archived. */
  async setListingStatus(
    id: string,
    status: 'active' | 'sold' | 'archived',
    sessionToken: string | null,
  ): Promise<{ ok: true; status: string }> {
    const vendorIds = await this.userVendorIds(sessionToken);
    const prod = (
      await this.db
        .select({ vendorId: product.vendorId })
        .from(product)
        .where(eq(product.id, id))
        .limit(1)
    )[0];
    if (!prod) throw new NotFoundException({ message: 'No such listing' });
    if (!vendorIds.includes(prod.vendorId)) {
      throw new ForbiddenException({ message: 'Not your listing' });
    }
    await this.db
      .update(product)
      .set({ status, updatedAt: new Date() })
      .where(eq(product.id, id));
    return { ok: true, status };
  }

  /** Edit one of the seller's own listings. */
  async updateListing(
    id: string,
    input: {
      title?: string;
      categorySlug?: string;
      description?: string;
      priceCents?: number;
      stock?: number;
      photos?: string[];
    },
    sessionToken: string | null,
  ): Promise<{ slug: string }> {
    const vendorIds = await this.userVendorIds(sessionToken);
    const prod = (
      await this.db
        .select({ id: product.id, slug: product.slug, vendorId: product.vendorId })
        .from(product)
        .where(eq(product.id, id))
        .limit(1)
    )[0];
    if (!prod) throw new NotFoundException({ message: 'No such listing' });
    if (!vendorIds.includes(prod.vendorId)) {
      throw new ForbiddenException({ message: 'Not your listing' });
    }

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined && input.title.trim().length >= 3) {
      set['titlePt'] = input.title.trim().slice(0, 140);
    }
    if (input.description !== undefined) set['descriptionPt'] = input.description.slice(0, 4000);
    if (input.categorySlug) {
      const cat = (
        await this.db
          .select({ id: category.id })
          .from(category)
          .where(eq(category.slug, input.categorySlug))
          .limit(1)
      )[0];
      if (cat) set['categoryId'] = cat.id;
    }
    await this.db.update(product).set(set).where(eq(product.id, id));

    if (
      (input.priceCents !== undefined && Number.isFinite(input.priceCents)) ||
      input.stock !== undefined
    ) {
      const vset: Record<string, unknown> = {};
      if (input.priceCents !== undefined && Number.isFinite(input.priceCents)) {
        vset['priceCents'] = Math.max(0, Math.trunc(input.priceCents));
      }
      if (input.stock !== undefined && Number.isFinite(input.stock)) {
        vset['stockQuantity'] = Math.max(0, Math.trunc(input.stock));
      }
      if (Object.keys(vset).length > 0) {
        await this.db.update(productVariant).set(vset).where(eq(productVariant.productId, id));
      }
    }

    // Full photo replacement: existing URLs are kept as-is; new data URLs are
    // stored as media. An empty list falls back to a generated placeholder.
    if (input.photos) {
      await this.db.delete(productImage).where(eq(productImage.productId, id));
      let sort = 0;
      for (const p of input.photos.slice(0, 6)) {
        let s3Key = p;
        if (p.startsWith('data:')) {
          try {
            s3Key = `/api/media/${await this.media.storeDataUrl(p)}`;
          } catch {
            continue;
          }
        }
        await this.db.insert(productImage).values({
          id: randomUUID(),
          productId: id,
          s3Key,
          width: 1024,
          height: 768,
          altText: (input.title ?? '').slice(0, 140) || null,
          sortOrder: sort++,
        });
      }
      if (sort === 0) {
        await this.db.insert(productImage).values({
          id: randomUUID(),
          productId: id,
          s3Key: `/ph?t=${encodeURIComponent(input.title ?? prod.slug)}`,
          width: 640,
          height: 480,
          altText: null,
          sortOrder: 0,
        });
      }
    }

    return { slug: prod.slug };
  }

  /** Remove (archive) one of the seller's own listings. */
  async archiveListing(id: string, sessionToken: string | null): Promise<{ ok: true }> {
    const vendorIds = await this.userVendorIds(sessionToken);
    const prod = (
      await this.db
        .select({ vendorId: product.vendorId })
        .from(product)
        .where(eq(product.id, id))
        .limit(1)
    )[0];
    if (!prod) throw new NotFoundException({ message: 'No such listing' });
    if (!vendorIds.includes(prod.vendorId)) {
      throw new ForbiddenException({ message: 'Not your listing' });
    }
    await this.db
      .update(product)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(product.id, id));
    return { ok: true };
  }

  /** The signed-in seller's existing shop (name + slug), or null if they have
   *  none yet — the new-listing form uses it to decide whether to ask for a
   *  shop name (first-time seller onboarding). */
  async myShop(
    sessionToken: string | null,
  ): Promise<{ slug: string; displayName: string } | null> {
    if (!sessionToken) return null;
    let user: AuthUser;
    try {
      user = await this.auth.me(sessionToken);
    } catch {
      return null;
    }
    const link = (
      await this.db
        .select({ vendorId: vendorUser.vendorId })
        .from(vendorUser)
        .where(eq(vendorUser.userId, user.id))
        .limit(1)
    )[0];
    if (!link) return null;
    const v = (
      await this.db
        .select({ slug: vendor.slug, displayName: vendor.displayName })
        .from(vendor)
        .where(eq(vendor.id, link.vendorId))
        .limit(1)
    )[0];
    return v ?? null;
  }

  /** The signed-in seller's own shop, created on their first listing. The
   *  chosen shop name is used only when the shop is first created. */
  private async ensureUserVendor(user: AuthUser, shopName?: string): Promise<string> {
    const link = (
      await this.db
        .select({ vendorId: vendorUser.vendorId })
        .from(vendorUser)
        .where(eq(vendorUser.userId, user.id))
        .limit(1)
    )[0];
    if (link) return link.vendorId;

    const dist = (await this.db.select({ id: district.id }).from(district).limit(1))[0];
    const name =
      shopName?.trim().slice(0, 80) || user.displayName.trim() || `Loja ${user.phoneE164.slice(-4)}`;
    const slug = await this.uniqueVendorSlug(name);
    const vendorId = randomUUID();
    const phone = user.phoneE164.replace(/^\+/, '');
    // status 'pending_kyc' → no "Verificado" selo until they pass KYC or go Pro.
    await this.db.insert(vendor).values({
      id: vendorId,
      slug,
      legalName: name,
      displayName: name,
      vendorType: 'individual',
      ...(dist ? { districtId: dist.id } : {}),
      status: 'pending_kyc',
      whatsapp: phone,
      contactPhone: phone,
    });
    await this.db.insert(vendorUser).values({
      id: randomUUID(),
      vendorId,
      userId: user.id,
      role: 'owner',
    });
    return vendorId;
  }

  private async uniqueVendorSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 50) || 'loja';
    for (let n = 0; n < 50; n++) {
      const candidate = n === 0 ? base : `${base}-${n + 1}`;
      const hit = (
        await this.db
          .select({ id: vendor.id })
          .from(vendor)
          .where(eq(vendor.slug, candidate))
          .limit(1)
      )[0];
      if (!hit) return candidate;
    }
    return `${base}-${randomUUID().slice(0, 6)}`;
  }

  /** The shared demo shop that owns visitor-created listings. */
  private async ensureCommunityVendor(): Promise<string> {
    const existing = (
      await this.db
        .select({ id: vendor.id })
        .from(vendor)
        .where(eq(vendor.slug, 'anuncios-demo'))
        .limit(1)
    )[0];
    if (existing) return existing.id;

    const dist = (await this.db.select({ id: district.id }).from(district).limit(1))[0];
    const id = randomUUID();
    await this.db.insert(vendor).values({
      id,
      slug: 'anuncios-demo',
      legalName: 'Anúncios da Comunidade',
      displayName: 'Anúncios da Comunidade',
      vendorType: 'individual',
      ...(dist ? { districtId: dist.id } : {}),
      status: 'active',
      whatsapp: '258840000000',
      contactPhone: '258840000000',
    });
    return id;
  }

  /** A URL-safe, unique slug derived from the title. */
  private async uniqueSlug(title: string): Promise<string> {
    const base =
      title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 60) || 'anuncio';
    for (let n = 0; n < 50; n++) {
      const candidate = n === 0 ? base : `${base}-${n + 1}`;
      const hit = (
        await this.db
          .select({ id: product.id })
          .from(product)
          .where(eq(product.slug, candidate))
          .limit(1)
      )[0];
      if (!hit) return candidate;
    }
    return `${base}-${randomUUID().slice(0, 6)}`;
  }

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
        attributes: product.attributes,
        publishedAt: product.publishedAt,
        featuredUntil: product.featuredUntil,
        bumpedAt: product.bumpedAt,
        vId: vendor.id,
        vSlug: vendor.slug,
        vName: vendor.displayName,
        vStatus: vendor.status,
        vProUntil: vendor.proUntil,
        vLocation: district.name,
        vRatingAvg: vendor.ratingAvg,
        vRatingCount: vendor.ratingCount,
      })
      .from(product)
      .innerJoin(vendor, eq(product.vendorId, vendor.id))
      .innerJoin(category, eq(product.categoryId, category.id))
      .leftJoin(district, eq(vendor.districtId, district.id))
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
          postedAt: p.publishedAt,
          featuredUntil: p.featuredUntil,
          attributes: p.attributes,
          vendor: {
            id: p.vId,
            slug: p.vSlug,
            displayName: p.vName,
            status: p.vStatus,
            proUntil: p.vProUntil,
            ratingAvg: p.vRatingAvg,
            ratingCount: p.vRatingCount,
            location: p.vLocation,
          },
          variants: variantsByProduct.get(p.id) ?? [],
          primaryImage: imagesByProduct.get(p.id) ?? null,
        },
        lang,
      ),
      // A bump surfaces the listing in "newest"/"relevance" as if just posted.
      publishedAt: recency(p.publishedAt, p.bumpedAt),
      attributes: p.attributes,
    }));

    if (filters.inStockOnly) mapped = mapped.filter((m) => m.item.inStock);
    if (filters.minPriceCents !== undefined)
      mapped = mapped.filter((m) => m.item.priceCents >= filters.minPriceCents!);
    if (filters.maxPriceCents !== undefined)
      mapped = mapped.filter((m) => m.item.priceCents <= filters.maxPriceCents!);

    // Per-category attribute filters: exact match for text/enum, min/max for
    // numbers. Values live in the product.attributes jsonb as strings.
    if (filters.attributes) {
      for (const [key, cond] of Object.entries(filters.attributes)) {
        mapped = mapped.filter((m) => {
          const raw = (m.attributes ?? {})[key];
          if (raw === undefined) return false;
          if (typeof cond === 'string') return raw === cond;
          const n = Number(raw);
          if (!Number.isFinite(n)) return false;
          if (cond.min !== undefined && n < cond.min) return false;
          if (cond.max !== undefined && n > cond.max) return false;
          return true;
        });
      }
    }

    mapped.sort(sorter(filters.sort ?? 'relevance'));
    // Featured (Destaque) listings rank above the rest, preserving the order
    // within each group (stable sort). Price sorts keep featured-first too.
    mapped.sort((a, b) => Number(b.item.featured) - Number(a.item.featured));

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
        publishedAt: product.publishedAt,
        viewCount: product.viewCount,
        contactCount: product.contactCount,
        shareCount: product.shareCount,
        featuredUntil: product.featuredUntil,
        cSlug: category.slug,
        cNamePt: category.namePt,
        cNameEn: category.nameEn,
        vId: vendor.id,
        vSlug: vendor.slug,
        vName: vendor.displayName,
        vStatus: vendor.status,
        vProUntil: vendor.proUntil,
        vLocation: district.name,
        vRatingAvg: vendor.ratingAvg,
        vRatingCount: vendor.ratingCount,
        vWhatsapp: vendor.whatsapp,
        vContactPhone: vendor.contactPhone,
        vShowWhatsapp: vendor.showWhatsapp,
        vShowPhone: vendor.showPhone,
      })
      .from(product)
      .innerJoin(category, eq(product.categoryId, category.id))
      .innerJoin(vendor, eq(product.vendorId, vendor.id))
      .leftJoin(district, eq(vendor.districtId, district.id))
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
        postedAt: p.publishedAt,
        featuredUntil: p.featuredUntil,
        attributes: p.attributes,
        vendor: {
          id: p.vId,
          slug: p.vSlug,
          displayName: p.vName,
          status: p.vStatus,
          proUntil: p.vProUntil,
          ratingAvg: p.vRatingAvg,
          ratingCount: p.vRatingCount,
          location: p.vLocation,
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
      vendor: {
        ...base.vendor,
        ...sellerContact({
          whatsapp: p.vWhatsapp,
          contactPhone: p.vContactPhone,
          showWhatsapp: p.vShowWhatsapp,
          showPhone: p.vShowPhone,
        }),
      },
      category: { slug: p.cSlug, name: pickText(p.cNamePt, p.cNameEn, lang) },
      description: pickText(p.descPt ?? '', p.descEn, lang),
      attributes: p.attributes,
      images: images.map(toImageDto),
      variants: active.map(toVariantDto),
      options: buildOptions(active),
      stats: { views: p.viewCount, contacts: p.contactCount, shares: p.shareCount },
    };
  }

  /** The filterable attributes defined for a category (for the filter UI). */
  async categoryAttributes(slug: string, lang: Lang): Promise<CategoryAttributeDto[]> {
    const rows = await this.db
      .select({
        key: categoryAttribute.key,
        labelPt: categoryAttribute.labelPt,
        labelEn: categoryAttribute.labelEn,
        dataType: categoryAttribute.dataType,
        options: categoryAttribute.options,
      })
      .from(categoryAttribute)
      .innerJoin(category, eq(categoryAttribute.categoryId, category.id))
      .where(and(eq(category.slug, slug), eq(categoryAttribute.isFilterable, true)))
      .orderBy(asc(categoryAttribute.sortOrder));
    return rows.map((r) => ({
      key: r.key,
      label: lang === 'en' ? r.labelEn : r.labelPt,
      dataType: r.dataType as CategoryAttributeDto['dataType'],
      options: r.options ?? null,
    }));
  }

  /** Record an engagement event on a listing, bumping the matching counter.
   *  Fire-and-forget from the client; best-effort. */
  /** File a trust-&-safety report against a listing (anonymous). */
  async createReport(idOrSlug: string, input: { reason: string; note?: string }): Promise<{ id: string }> {
    if (!(REPORT_REASONS as readonly string[]).includes(input.reason)) {
      throw new BadRequestException({ message: 'Motivo de denúncia inválido.' });
    }
    const rows = await this.db
      .select({ id: product.id, slug: product.slug })
      .from(product)
      .where(or(eq(product.slug, idOrSlug), eq(product.id, asUuidOrNil(idOrSlug))))
      .limit(1);
    const p = rows[0];
    if (p === undefined) throw new NotFoundException({ message: 'Anúncio não encontrado.' });
    const note =
      typeof input.note === 'string' && input.note.trim() !== ''
        ? input.note.trim().slice(0, 1000)
        : null;
    const id = randomUUID();
    await this.db
      .insert(listingReport)
      .values({ id, productId: p.id, productSlug: p.slug, reason: input.reason, note });
    return { id };
  }

  async recordEvent(idOrSlug: string, event: 'contact' | 'share' | 'view'): Promise<void> {
    const where = or(eq(product.slug, idOrSlug), eq(product.id, asUuidOrNil(idOrSlug)));
    const set =
      event === 'contact'
        ? { contactCount: sql`${product.contactCount} + 1` }
        : event === 'share'
          ? { shareCount: sql`${product.shareCount} + 1` }
          : { viewCount: sql`${product.viewCount} + 1` };
    await this.db.update(product).set(set).where(where);

    // A contact is worth telling the seller about.
    if (event === 'contact') {
      const p = (
        await this.db
          .select({ vendorId: product.vendorId, slug: product.slug, title: product.titlePt })
          .from(product)
          .where(where)
          .limit(1)
      )[0];
      if (p) {
        await this.notifications.notifyVendorOwners(p.vendorId, {
          type: 'contact',
          title: 'Novo contacto',
          body: p.title,
          href: `/produto/${p.slug}`,
        });
      }
    }
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

/** The more recent of publishedAt and bumpedAt — a bump counts as fresh. */
function recency(publishedAt: Date | null, bumpedAt: Date | null): Date | null {
  if (!bumpedAt) return publishedAt;
  if (!publishedAt) return bumpedAt;
  return bumpedAt.getTime() > publishedAt.getTime() ? bumpedAt : publishedAt;
}

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

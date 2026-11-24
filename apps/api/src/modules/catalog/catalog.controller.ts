import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import type {
  AttributeFilter,
  CategoryAttributeDto,
  Lang,
  ProductDetail,
  ProductFilters,
  ProductListResponse,
  SortKey,
} from './catalog.types.js';
import {
  ContactReveal,
  ListingEvent,
  ListingInput,
  ListingReport,
  ListingStatus,
} from '@nhonga/shared';
import { ZodBody } from '../../common/zod-body.js';
import { ContactOut, ListingCreatedOut, ProductListOut } from '@nhonga/shared';
import { Returns } from '../../common/returns.js';

const SORTS: readonly SortKey[] = ['relevance', 'price_asc', 'price_desc', 'rating', 'newest'];

interface CreateListingBody {
  title?: unknown;
  category?: unknown;
  description?: unknown;
  priceCents?: unknown;
  stock?: unknown;
  photos?: unknown;
  shopName?: unknown;
}

/** Public catalogue browse. No auth (security: [] in the contract). */
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Returns(ProductListOut)
  @Get('products')
  async list(
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('vendor') vendor?: string,
    @Query('province') province?: string,
    @Query('district') district?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('inStock') inStock?: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
    @Query('attributes') attributes?: string,
    @Query('cursor') cursor?: string,
  ): Promise<ProductListResponse> {
    const min = intOrUndef(minPrice);
    const max = intOrUndef(maxPrice);
    const lim = intOrUndef(limit);
    const s2 = sort && (SORTS as readonly string[]).includes(sort) ? (sort as SortKey) : undefined;
    const attrs = parseAttributes(attributes);
    const filters: ProductFilters = {
      ...(q ? { q } : {}),
      ...(category ? { categorySlug: category } : {}),
      ...(vendor ? { vendorSlug: vendor } : {}),
      ...(province ? { province } : {}),
      ...(district ? { district } : {}),
      ...(min !== undefined ? { minPriceCents: min } : {}),
      ...(max !== undefined ? { maxPriceCents: max } : {}),
      ...(inStock === 'true' ? { inStockOnly: true } : {}),
      ...(attrs ? { attributes: attrs } : {}),
      ...(s2 !== undefined ? { sort: s2 } : {}),
      ...(lim !== undefined ? { limit: lim } : {}),
      ...(cursor ? { cursor } : {}),
    };
    return this.catalog.listProductsCached(langOf(acceptLanguage), filters);
  }

  /** Live marketplace totals for the home social-proof strip. */
  @Get('stats')
  stats(): Promise<{ listings: number; vendors: number; verifiedVendors: number }> {
    return this.catalog.homeStatsCached();
  }

  /** Provinces for the location search picker. */
  @Get('provinces')
  provinces(): Promise<ReadonlyArray<{ code: string; name: string }>> {
    return this.catalog.provinces();
  }

  /** Districts (grouped by province client-side) for the location drill-down. */
  @Get('districts')
  districts(): Promise<ReadonlyArray<{ id: string; name: string; province: string }>> {
    return this.catalog.districts();
  }

  /** Create a listing ("Publicar"). Needs a session; 10 per shop per day. */
  @Returns(ListingCreatedOut)
  @Post('products')
  @HttpCode(201)
  create(
    @Body(new ZodBody(ListingInput)) body: CreateListingBody,
    @Headers('authorization') authz?: string,
  ): Promise<{ id: string; slug: string }> {
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    const num = (v: unknown): number =>
      typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    const photos = Array.isArray(body.photos)
      ? body.photos.filter((p): p is string => typeof p === 'string')
      : [];
    const token = authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
    return this.catalog.createListing(
      {
        title: str(body.title),
        categorySlug: str(body.category),
        description: str(body.description),
        priceCents: num(body.priceCents),
        stock: num(body.stock),
        photos,
        ...(str(body.shopName) ? { shopName: str(body.shopName) } : {}),
      },
      token,
    );
  }

  /** The signed-in seller's shop (name + slug), or null — drives first-time
   *  seller onboarding on the new-listing form. */
  @Get('mine/shop')
  myShop(
    @Headers('authorization') authz?: string,
  ): Promise<{ slug: string; displayName: string } | null> {
    return this.catalog.myShop(bearer(authz));
  }

  /** The signed-in seller's own listings, for the "A minha loja" panel. */
  @Get('mine/products')
  mineProducts(
    @Headers('accept-language') acceptLanguage?: string,
    @Headers('authorization') authz?: string,
  ): Promise<unknown> {
    return this.catalog.mineProducts(bearer(authz), langOf(acceptLanguage));
  }

  /** Edit one of the seller's own listings. */
  @Patch('products/:id')
  update(
    @Param('id') id: string,
    @Body(new ZodBody(ListingInput)) body: CreateListingBody,
    @Headers('authorization') authz?: string,
  ): Promise<{ slug: string }> {
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
    const numOrUndef = (v: unknown): number | undefined =>
      v === undefined || v === null || v === ''
        ? undefined
        : Number.isFinite(Number(v))
          ? Number(v)
          : undefined;
    const photos = Array.isArray(body.photos)
      ? body.photos.filter((p): p is string => typeof p === 'string')
      : undefined;
    return this.catalog.updateListing(
      id,
      {
        ...(str(body.title) !== undefined ? { title: str(body.title)! } : {}),
        ...(str(body.category) ? { categorySlug: str(body.category)! } : {}),
        ...(str(body.description) !== undefined ? { description: str(body.description)! } : {}),
        ...(numOrUndef(body.priceCents) !== undefined
          ? { priceCents: numOrUndef(body.priceCents)! }
          : {}),
        ...(numOrUndef(body.stock) !== undefined ? { stock: numOrUndef(body.stock)! } : {}),
        ...(photos ? { photos } : {}),
      },
      bearer(authz),
    );
  }

  /** Remove (archive) one of the seller's own listings. */
  @Delete('products/:id')
  remove(@Param('id') id: string, @Headers('authorization') authz?: string): Promise<{ ok: true }> {
    return this.catalog.archiveListing(id, bearer(authz));
  }

  /** Change a listing's status: active / sold / archived (seller only). */
  @Patch('products/:id/status')
  setStatus(
    @Param('id') id: string,
    @Body(new ZodBody(ListingStatus)) body: { status?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<{ ok: true; status: string }> {
    const status = body.status;
    if (status !== 'active' && status !== 'sold' && status !== 'archived') {
      throw new BadRequestException({ message: 'status must be active, sold or archived' });
    }
    return this.catalog.setListingStatus(id, status, bearer(authz));
  }

  /** Public shop detail (header, trust, contact, stats). */
  @Get('shops/:slug')
  shop(@Param('slug') slug: string): Promise<unknown> {
    return this.catalog.getShop(slug);
  }

  /** Title suggestions for the search autocomplete. */
  @Get('suggest')
  suggest(
    @Query('q') q?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<{ slug: string; title: string }[]> {
    return this.catalog.suggestCached(q ?? '', langOf(acceptLanguage));
  }

  /** Filterable attributes for a category (drives the per-category filter UI). */
  @Get('categories/:slug/attributes')
  categoryAttributes(
    @Param('slug') slug: string,
    @Headers('accept-language') acceptLanguage: string | undefined,
  ): Promise<CategoryAttributeDto[]> {
    return this.catalog.categoryAttributes(slug, langOf(acceptLanguage));
  }

  @Get('products/:idOrSlug')
  async detail(
    @Param('idOrSlug') idOrSlug: string,
    @Headers('accept-language') acceptLanguage: string | undefined,
  ): Promise<ProductDetail> {
    return this.catalog.getProduct(idOrSlug, langOf(acceptLanguage));
  }

  /** Record an engagement event (contact / share / view) on a listing. */
  @Post('products/:idOrSlug/events')
  @HttpCode(204)
  async event(
    @Param('idOrSlug') idOrSlug: string,
    @Body(new ZodBody(ListingEvent)) body: { type?: unknown },
  ): Promise<void> {
    const type = body.type;
    if (type !== 'contact' && type !== 'share' && type !== 'view') {
      throw new BadRequestException({ message: 'type must be contact, share or view' });
    }
    await this.catalog.recordEvent(idOrSlug, type);
  }

  /** The seller's numbers, on request (PRIV-01). Rate limited per client. */
  @Returns(ContactOut)
  @Post('contacts')
  @HttpCode(200)
  contact(
    @Body(new ZodBody(ContactReveal)) body: { productSlug?: string; vendorSlug?: string },
  ): Promise<{ whatsapp: string | null; phone: string | null }> {
    return this.catalog.revealContact(body);
  }

  /** File a trust-&-safety report against a listing (anonymous). */
  @Post('products/:idOrSlug/reports')
  @HttpCode(201)
  async report(
    @Param('idOrSlug') idOrSlug: string,
    @Body(new ZodBody(ListingReport)) body: { reason?: unknown; note?: unknown },
  ): Promise<{ id: string }> {
    const reason = typeof body.reason === 'string' ? body.reason : '';
    const note = typeof body.note === 'string' ? body.note : undefined;
    return this.catalog.createReport(idOrSlug, {
      reason,
      ...(note !== undefined ? { note } : {}),
    });
  }
}

/** Parse the `attributes` query param: a JSON map of {key: "value"} (exact) or
 *  {key: {min,max}} (numeric range). Malformed input is ignored, not fatal. */
function parseAttributes(raw: string | undefined): Record<string, AttributeFilter> | undefined {
  if (!raw) return undefined;
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof obj !== 'object' || obj === null) return undefined;
  const out: Record<string, AttributeFilter> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === 'string') {
      if (v.trim() !== '') out[k] = v;
    } else if (typeof v === 'object' && v !== null) {
      const range = v as { min?: unknown; max?: unknown };
      const f: { min?: number; max?: number } = {};
      if (typeof range.min === 'number' && Number.isFinite(range.min)) f.min = range.min;
      if (typeof range.max === 'number' && Number.isFinite(range.max)) f.max = range.max;
      if (f.min !== undefined || f.max !== undefined) out[k] = f;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function bearer(authz: string | undefined): string | null {
  return authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
}

function intOrUndef(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

/** Portuguese-first: anything not explicitly English is served pt. */
function langOf(header: string | undefined): Lang {
  return header?.toLowerCase().startsWith('en') ? 'en' : 'pt';
}

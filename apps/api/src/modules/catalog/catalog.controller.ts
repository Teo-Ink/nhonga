import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
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

const SORTS: readonly SortKey[] = ['relevance', 'price_asc', 'price_desc', 'rating', 'newest'];

/** Public catalogue browse. No auth (security: [] in the contract). */
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  async list(
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('vendor') vendor?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('inStock') inStock?: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
    @Query('attributes') attributes?: string,
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
      ...(min !== undefined ? { minPriceCents: min } : {}),
      ...(max !== undefined ? { maxPriceCents: max } : {}),
      ...(inStock === 'true' ? { inStockOnly: true } : {}),
      ...(attrs ? { attributes: attrs } : {}),
      ...(s2 !== undefined ? { sort: s2 } : {}),
      ...(lim !== undefined ? { limit: lim } : {}),
    };
    return this.catalog.listProducts(langOf(acceptLanguage), filters);
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
    @Body() body: { type?: unknown },
  ): Promise<void> {
    const type = body.type;
    if (type !== 'contact' && type !== 'share' && type !== 'view') {
      throw new BadRequestException({ message: 'type must be contact, share or view' });
    }
    await this.catalog.recordEvent(idOrSlug, type);
  }

  /** File a trust-&-safety report against a listing (anonymous). */
  @Post('products/:idOrSlug/reports')
  @HttpCode(201)
  async report(
    @Param('idOrSlug') idOrSlug: string,
    @Body() body: { reason?: unknown; note?: unknown },
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

function intOrUndef(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

/** Portuguese-first: anything not explicitly English is served pt. */
function langOf(header: string | undefined): Lang {
  return header?.toLowerCase().startsWith('en') ? 'en' : 'pt';
}

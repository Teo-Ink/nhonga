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
  ): Promise<ProductListResponse> {
    const min = intOrUndef(minPrice);
    const max = intOrUndef(maxPrice);
    const lim = intOrUndef(limit);
    const s2 = sort && (SORTS as readonly string[]).includes(sort) ? (sort as SortKey) : undefined;
    const filters: ProductFilters = {
      ...(q ? { q } : {}),
      ...(category ? { categorySlug: category } : {}),
      ...(vendor ? { vendorSlug: vendor } : {}),
      ...(min !== undefined ? { minPriceCents: min } : {}),
      ...(max !== undefined ? { maxPriceCents: max } : {}),
      ...(inStock === 'true' ? { inStockOnly: true } : {}),
      ...(s2 !== undefined ? { sort: s2 } : {}),
      ...(lim !== undefined ? { limit: lim } : {}),
    };
    return this.catalog.listProducts(langOf(acceptLanguage), filters);
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

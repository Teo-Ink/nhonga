import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import type { Lang, ProductDetail, ProductListResponse } from './catalog.types.js';

/** Public catalogue browse. No auth (security: [] in the contract). */
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  async list(
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Query('limit') limit?: string,
  ): Promise<ProductListResponse> {
    const n = Math.min(Math.max(Number(limit ?? 24) || 24, 1), 48);
    return this.catalog.listProducts(langOf(acceptLanguage), n);
  }

  @Get('products/:idOrSlug')
  async detail(
    @Param('idOrSlug') idOrSlug: string,
    @Headers('accept-language') acceptLanguage: string | undefined,
  ): Promise<ProductDetail> {
    return this.catalog.getProduct(idOrSlug, langOf(acceptLanguage));
  }
}

/** Portuguese-first: anything that is not explicitly English is served pt. */
function langOf(header: string | undefined): Lang {
  return header?.toLowerCase().startsWith('en') ? 'en' : 'pt';
}

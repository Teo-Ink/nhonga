import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { FavoritesService, type FavoriteDto } from './favorites.service.js';
import { FavoriteAdd } from '@nhonga/shared';
import { ZodBody } from '../../common/zod-body.js';

function bearer(authz: string | undefined): string | null {
  return authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
}

/** Server-side favourites + price-drop alerts (J). */
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@Headers('authorization') authz?: string): Promise<FavoriteDto[]> {
    return this.favorites.list(bearer(authz));
  }

  @Post()
  @HttpCode(200)
  add(
    @Body(new ZodBody(FavoriteAdd)) body: { productId?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<{ ok: true }> {
    const id = typeof body.productId === 'string' ? body.productId : '';
    if (!id) return Promise.resolve({ ok: true });
    return this.favorites.add(id, bearer(authz));
  }

  @Delete(':productId')
  @HttpCode(200)
  remove(
    @Param('productId') productId: string,
    @Headers('authorization') authz?: string,
  ): Promise<{ ok: true }> {
    return this.favorites.remove(productId, bearer(authz));
  }
}

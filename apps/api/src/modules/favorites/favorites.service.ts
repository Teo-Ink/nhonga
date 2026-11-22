import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { favorite } from '../../db/schema/favorites.js';
import { product, productVariant } from '../../db/schema/catalog.js';
import { AuthService } from '../auth/auth.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export interface FavoriteDto {
  productId: string;
  slug: string;
  savedPriceCents: number;
}

@Injectable()
export class FavoritesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly auth: AuthService,
    private readonly notifications: NotificationsService,
  ) {}

  private async userId(token: string | null): Promise<string | null> {
    if (!token) return null;
    try {
      return (await this.auth.me(token)).id;
    } catch {
      return null;
    }
  }

  /** Current (lowest active) price of a listing, in cents. */
  private async priceOf(productId: string): Promise<number> {
    const row = (
      await this.db
        .select({ price: sql<number>`min(${productVariant.priceCents})::bigint` })
        .from(productVariant)
        .where(and(eq(productVariant.productId, productId), eq(productVariant.isActive, true)))
    )[0];
    return Number(row?.price ?? 0);
  }

  async add(productId: string, token: string | null): Promise<{ ok: true }> {
    const uid = await this.userId(token);
    if (!uid) return { ok: true };
    const price = await this.priceOf(productId);
    await this.db
      .insert(favorite)
      .values({ userId: uid, productId, savedPriceCents: price })
      .onConflictDoUpdate({
        target: [favorite.userId, favorite.productId],
        set: { savedPriceCents: price },
      });
    return { ok: true };
  }

  async remove(productId: string, token: string | null): Promise<{ ok: true }> {
    const uid = await this.userId(token);
    if (!uid) return { ok: true };
    await this.db
      .delete(favorite)
      .where(and(eq(favorite.userId, uid), eq(favorite.productId, productId)));
    return { ok: true };
  }

  async list(token: string | null): Promise<FavoriteDto[]> {
    const uid = await this.userId(token);
    if (!uid) return [];
    const rows = await this.db
      .select({
        productId: favorite.productId,
        slug: product.slug,
        savedPriceCents: favorite.savedPriceCents,
      })
      .from(favorite)
      .innerJoin(product, eq(favorite.productId, product.id))
      .where(eq(favorite.userId, uid));
    return rows.map((r) => ({
      productId: r.productId,
      slug: r.slug,
      savedPriceCents: r.savedPriceCents,
    }));
  }

  /** Called when a listing's price changes. If it dropped below what a user had
   *  saved, alert them and reset their baseline so they're not re-notified. */
  async onPriceChange(productId: string, newPriceCents: number): Promise<void> {
    try {
      const watchers = await this.db
        .select({ userId: favorite.userId })
        .from(favorite)
        .where(and(eq(favorite.productId, productId), gt(favorite.savedPriceCents, newPriceCents)));
      if (watchers.length === 0) return;

      const p = (
        await this.db
          .select({ slug: product.slug, title: product.titlePt })
          .from(product)
          .where(eq(product.id, productId))
          .limit(1)
      )[0];
      const href = p ? `/produto/${p.slug}` : undefined;
      const title = p?.title ?? '';
      await Promise.all(
        watchers.map((w) =>
          this.notifications.notifyUser(w.userId, {
            type: 'price_drop',
            title: 'Baixa de preço',
            body: title,
            ...(href ? { href } : {}),
          }),
        ),
      );
      await this.db
        .update(favorite)
        .set({ savedPriceCents: newPriceCents })
        .where(and(eq(favorite.productId, productId), gt(favorite.savedPriceCents, newPriceCents)));
    } catch {
      /* best-effort */
    }
  }
}

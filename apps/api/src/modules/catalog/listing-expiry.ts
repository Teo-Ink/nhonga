import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import { product } from '../../db/schema/catalog.js';
import type { Db } from '../../db/types.js';

/**
 * Listings expire (P2-10). A listing nobody has published, bumped or edited
 * for LISTING_TTL_DAYS days is archived: it leaves search, the seller can put
 * it back from "Os meus anúncios". Old, sold-but-not-marked listings are the
 * main source of wasted calls on classifieds sites.
 *
 * LISTING_TTL_DAYS=0 (the default) turns this off; production sets 90.
 */
export function listingTtlDays(raw = process.env['LISTING_TTL_DAYS']): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

@Injectable()
export class ListingExpiry implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('ListingExpiry');
  private timer: NodeJS.Timeout | null = null;

  constructor(@Inject(DB) private readonly db: Db) {}

  /** Archives stale active listings; returns how many. */
  async expire(days: number): Promise<number> {
    if (days <= 0) return 0;
    const rows = await this.db
      .update(product)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(
        and(
          eq(product.status, 'active'),
          sql`greatest(${product.publishedAt}, ${product.bumpedAt}, ${product.updatedAt})
              < now() - make_interval(days => ${days})`,
        ),
      )
      .returning({ id: product.id });
    return rows.length;
  }

  onApplicationBootstrap(): void {
    const days = listingTtlDays();
    if (days === 0) return;
    const run = () =>
      void this.expire(days)
        .then((n) => n > 0 && this.log.log(`listing_expired count=${n} ttl_days=${days}`))
        .catch((e: unknown) => this.log.warn(`expiry failed: ${String(e)}`));
    this.timer = setInterval(run, 6 * 3_600_000);
    this.timer.unref();
    run();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}

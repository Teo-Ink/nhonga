import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { review } from '../../db/schema/reviews.js';
import { vendor } from '../../db/schema/vendors.js';
import { product } from '../../db/schema/catalog.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export class ReviewError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_input' | 'not_found',
  ) {
    super(message);
    this.name = 'ReviewError';
  }
}

export interface ReviewDto {
  id: string;
  author: string;
  rating: number;
  comment: string | null;
  productSlug: string | null;
  createdAt: string;
}
export interface ReviewSummary {
  ratingAvg: number | null;
  ratingCount: number;
}
export interface ReviewListDto {
  items: ReviewDto[];
  summary: ReviewSummary;
}
export interface CreateReviewInput {
  rating: number;
  comment?: string;
  productSlug?: string;
}

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly notifications: NotificationsService,
  ) {}

  /** Published reviews for a vendor, newest first, with a rating summary. */
  async list(vendorId: string): Promise<ReviewListDto> {
    const rows = await this.db
      .select({
        id: review.id,
        author: review.authorName,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        productSlug: product.slug,
      })
      .from(review)
      .leftJoin(product, eq(review.productId, product.id))
      .where(and(eq(review.vendorId, vendorId), eq(review.status, 'published')))
      .orderBy(desc(review.createdAt));

    const items: ReviewDto[] = rows.map((r) => ({
      id: r.id,
      author: r.author,
      rating: r.rating,
      comment: r.comment,
      productSlug: r.productSlug,
      createdAt: r.createdAt.toISOString(),
    }));
    return { items, summary: summarise(items) };
  }

  /** Create or edit the author's review for a vendor, then refresh the vendor's rating. */
  async create(
    vendorId: string,
    authorUserId: string,
    authorName: string,
    input: CreateReviewInput,
  ): Promise<ReviewDto> {
    const rating = Math.trunc(Number(input.rating));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new ReviewError('A avaliação deve ser de 1 a 5 estrelas.', 'invalid_input');
    }
    const comment =
      typeof input.comment === 'string' && input.comment.trim() !== ''
        ? input.comment.trim().slice(0, 1000)
        : null;

    const v = await this.db
      .select({ id: vendor.id })
      .from(vendor)
      .where(eq(vendor.id, vendorId))
      .limit(1);
    if (v[0] === undefined) throw new ReviewError('Vendedor não encontrado.', 'not_found');

    // Optional listing reference — only if it belongs to this vendor.
    let productId: string | null = null;
    if (input.productSlug) {
      const p = await this.db
        .select({ id: product.id })
        .from(product)
        .where(and(eq(product.slug, input.productSlug), eq(product.vendorId, vendorId)))
        .limit(1);
      productId = p[0]?.id ?? null;
    }

    await this.db
      .insert(review)
      .values({ id: randomUUID(), vendorId, productId, authorUserId, authorName, rating, comment })
      .onConflictDoUpdate({
        target: [review.vendorId, review.authorUserId],
        set: { rating, comment, productId, authorName, updatedAt: new Date() },
      });

    await this.refreshVendorRating(vendorId);

    const vs = (
      await this.db.select({ slug: vendor.slug }).from(vendor).where(eq(vendor.id, vendorId)).limit(1)
    )[0];
    await this.notifications.notifyVendorOwners(vendorId, {
      type: 'review',
      title: 'Nova avaliação',
      body: `${rating}★${comment ? ` — ${comment.slice(0, 60)}` : ''}`,
      ...(vs ? { href: `/loja/${vs.slug}` } : {}),
    });

    const created = await this.db
      .select({
        id: review.id,
        author: review.authorName,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        productSlug: product.slug,
      })
      .from(review)
      .leftJoin(product, eq(review.productId, product.id))
      .where(and(eq(review.vendorId, vendorId), eq(review.authorUserId, authorUserId)))
      .limit(1);
    const r = created[0]!;
    return {
      id: r.id,
      author: r.author,
      rating: r.rating,
      comment: r.comment,
      productSlug: r.productSlug,
      createdAt: r.createdAt.toISOString(),
    };
  }

  /** Recompute the denormalised vendor.rating_avg / rating_count from published reviews. */
  private async refreshVendorRating(vendorId: string): Promise<void> {
    const { summary } = await this.list(vendorId);
    await this.db
      .update(vendor)
      .set({
        ratingAvg: summary.ratingAvg === null ? null : summary.ratingAvg.toFixed(1),
        ratingCount: summary.ratingCount,
        updatedAt: new Date(),
      })
      .where(eq(vendor.id, vendorId));
  }
}

function summarise(items: ReviewDto[]): ReviewSummary {
  const count = items.length;
  if (count === 0) return { ratingAvg: null, ratingCount: 0 };
  const avg = items.reduce((s, i) => s + i.rating, 0) / count;
  return { ratingAvg: Math.round(avg * 10) / 10, ratingCount: count };
}

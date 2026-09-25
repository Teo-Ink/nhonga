import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, desc, eq } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import type { AppConfig } from '../../config/config.schema.js';
import { product } from '../../db/schema/catalog.js';
import { productPromotion, promotionPlan } from '../../db/schema/promotions.js';
import { PaymentProvidersService } from '../payments/providers.service.js';
import type { ProviderId } from '../payments/payment-provider.interface.js';

export class PromotionError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_input' | 'not_found' | 'unavailable',
  ) {
    super(message);
    this.name = 'PromotionError';
  }
}

export interface PlanDto {
  code: string;
  name: string;
  kind: 'feature' | 'bump';
  priceCents: number;
  durationDays: number;
}
export interface PurchaseInput {
  productSlug: string;
  planCode: string;
  paymentMethod: string;
  payPhone?: string;
}
export interface ReceiptDto {
  id: string;
  productSlug: string;
  productTitle: string;
  planCode: string;
  planName: string;
  amountCents: number;
  paymentMethod: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

@Injectable()
export class PromotionsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly providers: PaymentProvidersService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async listPlans(lang: 'pt' | 'en'): Promise<PlanDto[]> {
    const rows = await this.db
      .select()
      .from(promotionPlan)
      .where(eq(promotionPlan.isActive, true))
      .orderBy(asc(promotionPlan.sortOrder));
    return rows.map((p) => ({
      code: p.code,
      name: lang === 'en' ? p.nameEn : p.namePt,
      kind: p.kind as 'feature' | 'bump',
      priceCents: p.priceCents,
      durationDays: p.durationDays,
    }));
  }

  /**
   * Buy a promotion for a listing. The payment method is validated against the
   * real provider registry. In mock mode the payment settles immediately and
   * the promotion is applied; the live wallet flow (charge + callback) is not
   * wired for promotions yet, so live mode reports it as unavailable.
   */
  async purchase(
    input: PurchaseInput,
  ): Promise<{ id: string; status: string; receipt: ReceiptDto }> {
    const method = input.paymentMethod as ProviderId;
    if (this.providers.get(method) === undefined) {
      throw new PromotionError('unknown payment method', 'invalid_input');
    }

    const prod = (
      await this.db
        .select({ id: product.id, slug: product.slug, title: product.titlePt })
        .from(product)
        .where(eq(product.slug, input.productSlug))
        .limit(1)
    )[0];
    if (!prod) throw new PromotionError('listing not found', 'not_found');

    const plan = (
      await this.db
        .select()
        .from(promotionPlan)
        .where(eq(promotionPlan.code, input.planCode))
        .limit(1)
    )[0];
    if (!plan || !plan.isActive) throw new PromotionError('plan not found', 'not_found');

    if (this.config.get('paymentsMode', { infer: true }) !== 'mock') {
      throw new PromotionError('promotion payments are not available yet', 'unavailable');
    }

    const id = randomUUID();
    const startsAt = new Date();
    const endsAt =
      plan.kind === 'feature'
        ? new Date(startsAt.getTime() + plan.durationDays * 86_400_000)
        : null;

    // Mock: settle immediately and apply.
    await this.db.insert(productPromotion).values({
      id,
      productId: prod.id,
      planCode: plan.code,
      amountCents: plan.priceCents,
      paymentMethod: method,
      status: 'active',
      startsAt,
      endsAt,
    });

    if (plan.kind === 'feature') {
      await this.db
        .update(product)
        .set({ featuredUntil: endsAt, bumpedAt: startsAt })
        .where(eq(product.id, prod.id));
    } else {
      await this.db.update(product).set({ bumpedAt: startsAt }).where(eq(product.id, prod.id));
    }

    return { id, status: 'active', receipt: await this.receipt(id) };
  }

  async receipt(id: string): Promise<ReceiptDto> {
    const row = (
      await this.db
        .select({
          id: productPromotion.id,
          planCode: productPromotion.planCode,
          amountCents: productPromotion.amountCents,
          paymentMethod: productPromotion.paymentMethod,
          status: productPromotion.status,
          startsAt: productPromotion.startsAt,
          endsAt: productPromotion.endsAt,
          createdAt: productPromotion.createdAt,
          slug: product.slug,
          title: product.titlePt,
          planName: promotionPlan.namePt,
        })
        .from(productPromotion)
        .innerJoin(product, eq(productPromotion.productId, product.id))
        .innerJoin(promotionPlan, eq(productPromotion.planCode, promotionPlan.code))
        .where(eq(productPromotion.id, id))
        .limit(1)
    )[0];
    if (!row) throw new PromotionError('promotion not found', 'not_found');
    return {
      id: row.id,
      productSlug: row.slug,
      productTitle: row.title,
      planCode: row.planCode,
      planName: row.planName,
      amountCents: row.amountCents,
      paymentMethod: row.paymentMethod,
      status: row.status,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Admin-lite: active promotions with their listing, for the ops view (E4). */
  async listActive(): Promise<ReceiptDto[]> {
    const rows = await this.db
      .select({ id: productPromotion.id })
      .from(productPromotion)
      .where(and(eq(productPromotion.status, 'active')))
      .orderBy(desc(productPromotion.createdAt))
      .limit(100);
    return Promise.all(rows.map((r) => this.receipt(r.id)));
  }
}

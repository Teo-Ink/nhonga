import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import type { AppConfig } from '../../config/config.schema.js';
import { vendor, vendorSubscription } from '../../db/schema/vendors.js';
import { PaymentProvidersService } from '../payments/providers.service.js';
import type { ProviderId } from '../payments/payment-provider.interface.js';

export class SubscriptionError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_input' | 'not_found' | 'unavailable',
  ) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

export interface SubPlanDto {
  code: string;
  name: string;
  priceCents: number;
  durationDays: number;
}
export interface SubscribeInput {
  vendorSlug: string;
  planCode: string;
  paymentMethod: string;
}
export interface SubReceiptDto {
  id: string;
  vendorSlug: string;
  vendorName: string;
  planCode: string;
  planName: string;
  amountCents: number;
  paymentMethod: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

// "Loja Pro" subscription plans. Kept in code (not a table) — a single monthly
// tier that grants the verified selo + Pro benefits. Prices in cents of MT.
const PLANS = [
  { code: 'pro', namePt: 'Loja Pro', nameEn: 'Pro Shop', priceCents: 75000, durationDays: 30 },
] as const;

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly providers: PaymentProvidersService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  listPlans(lang: 'pt' | 'en'): SubPlanDto[] {
    return PLANS.map((p) => ({
      code: p.code,
      name: lang === 'en' ? p.nameEn : p.namePt,
      priceCents: p.priceCents,
      durationDays: p.durationDays,
    }));
  }

  /**
   * Subscribe a shop to Loja Pro. The payment method is validated against the
   * real provider registry. In mock mode the payment settles immediately and
   * the shop becomes Pro (proUntil moved forward); the live wallet flow is not
   * wired for subscriptions yet, so live mode reports it as unavailable.
   */
  async subscribe(
    input: SubscribeInput,
  ): Promise<{ id: string; status: string; receipt: SubReceiptDto }> {
    const method = input.paymentMethod as ProviderId;
    if (this.providers.get(method) === undefined) {
      throw new SubscriptionError('unknown payment method', 'invalid_input');
    }

    const plan = PLANS.find((p) => p.code === input.planCode);
    if (!plan) throw new SubscriptionError('plan not found', 'not_found');

    const shop = (
      await this.db
        .select({ id: vendor.id, slug: vendor.slug, name: vendor.displayName, proUntil: vendor.proUntil })
        .from(vendor)
        .where(eq(vendor.slug, input.vendorSlug))
        .limit(1)
    )[0];
    if (!shop) throw new SubscriptionError('shop not found', 'not_found');

    if (this.config.get('paymentsMode', { infer: true }) !== 'mock') {
      throw new SubscriptionError('subscription payments are not available yet', 'unavailable');
    }

    const id = randomUUID();
    const startsAt = new Date();
    // Extend from the later of now / current proUntil, so renewals stack.
    const base =
      shop.proUntil && shop.proUntil.getTime() > startsAt.getTime() ? shop.proUntil : startsAt;
    const endsAt = new Date(base.getTime() + plan.durationDays * 86_400_000);

    await this.db.insert(vendorSubscription).values({
      id,
      vendorId: shop.id,
      planCode: plan.code,
      amountCents: plan.priceCents,
      paymentMethod: method,
      status: 'active',
      startsAt,
      endsAt,
    });
    await this.db.update(vendor).set({ proUntil: endsAt }).where(eq(vendor.id, shop.id));

    return { id, status: 'active', receipt: await this.receipt(id) };
  }

  async receipt(id: string): Promise<SubReceiptDto> {
    const row = (
      await this.db
        .select({
          id: vendorSubscription.id,
          planCode: vendorSubscription.planCode,
          amountCents: vendorSubscription.amountCents,
          paymentMethod: vendorSubscription.paymentMethod,
          status: vendorSubscription.status,
          startsAt: vendorSubscription.startsAt,
          endsAt: vendorSubscription.endsAt,
          createdAt: vendorSubscription.createdAt,
          slug: vendor.slug,
          name: vendor.displayName,
        })
        .from(vendorSubscription)
        .innerJoin(vendor, eq(vendorSubscription.vendorId, vendor.id))
        .where(eq(vendorSubscription.id, id))
        .limit(1)
    )[0];
    if (!row) throw new SubscriptionError('subscription not found', 'not_found');
    const plan = PLANS.find((p) => p.code === row.planCode);
    return {
      id: row.id,
      vendorSlug: row.slug,
      vendorName: row.name,
      planCode: row.planCode,
      planName: plan?.namePt ?? row.planCode,
      amountCents: row.amountCents,
      paymentMethod: row.paymentMethod,
      status: row.status,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

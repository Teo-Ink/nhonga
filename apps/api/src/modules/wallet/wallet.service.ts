import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { wallet, walletTransaction } from '../../db/schema/wallet.js';
import { vendor, vendorUser } from '../../db/schema/vendors.js';
import { product } from '../../db/schema/catalog.js';
import { AuthService } from '../auth/auth.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';

export interface WalletPackage {
  id: string;
  name: string;
  /** What the buyer pays (demo — no live gateway), in cents of MT. */
  priceCents: number;
  /** Balance credited to the wallet, in cents (may exceed price = bonus). */
  balanceCents: number;
  /** Loyalty points credited. */
  points: number;
}

export interface WalletTx {
  id: string;
  kind: string;
  amountCents: number;
  points: number;
  description: string;
  createdAt: string;
}

export interface WalletView {
  hasShop: boolean;
  shopName: string | null;
  balanceCents: number;
  points: number;
  /** "Loja Pro" subscription: active flag + expiry (ISO) when active. */
  isPro: boolean;
  proUntil: string | null;
  transactions: WalletTx[];
}

/** Loja Pro subscription: monthly price and duration. */
export const PRO_PRICE_CENTS = 75000; // 750 MT / month
const PRO_DAYS = 30;

export interface BoostResult {
  wallet: WalletView;
  planName: string;
  endsAt: string | null;
}

// Prepaid seller packages. Buying one credits balance (+ a bonus) and loyalty
// points. Demo payment: the balance is real and persisted, but no money moves.
const PACKAGES: readonly WalletPackage[] = [
  { id: 'basico', name: 'Pacote Básico', priceCents: 10000, balanceCents: 10000, points: 10 },
  { id: 'popular', name: 'Pacote Popular', priceCents: 50000, balanceCents: 55000, points: 60 },
  { id: 'pro', name: 'Pacote Pro', priceCents: 100000, balanceCents: 115000, points: 150 },
];

const MAX_TOPUP_CENTS = 10_000_000; // 100 000 MT per top-up

// Points cost of a bump plan: 1 point ≈ 1 MT of the plan's price.
const pointsCostOf = (priceCents: number): number => Math.max(1, Math.round(priceCents / 100));

// A promotion plan as the wallet presents it: feature plans cost balance,
// bump plans cost loyalty points.
export interface BoostPlanDto {
  code: string;
  name: string;
  kind: 'feature' | 'bump';
  priceCents: number;
  pointsCost: number;
  durationDays: number;
}

@Injectable()
export class WalletService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly auth: AuthService,
    private readonly promotions: PromotionsService,
  ) {}

  packages(): readonly WalletPackage[] {
    return PACKAGES;
  }

  /** Promotion plans, priced the way the wallet charges them (balance vs points). */
  async boostPlans(lang: 'pt' | 'en'): Promise<BoostPlanDto[]> {
    const plans = await this.promotions.listPlans(lang);
    return plans.map((p) => ({
      code: p.code,
      name: p.name,
      kind: p.kind,
      priceCents: p.kind === 'feature' ? p.priceCents : 0,
      pointsCost: p.kind === 'bump' ? pointsCostOf(p.priceCents) : 0,
      durationDays: p.durationDays,
    }));
  }

  /** The signed-in user's shop (first vendor they own), or null. */
  private async vendorOf(token: string | null): Promise<{ id: string; name: string } | null> {
    if (!token) return null;
    let userId: string;
    try {
      userId = (await this.auth.me(token)).id;
    } catch {
      return null;
    }
    const row = (
      await this.db
        .select({ id: vendor.id, name: vendor.displayName })
        .from(vendorUser)
        .innerJoin(vendor, eq(vendor.id, vendorUser.vendorId))
        .where(eq(vendorUser.userId, userId))
        .limit(1)
    )[0];
    return row ?? null;
  }

  private async ensureWallet(vendorId: string): Promise<void> {
    await this.db.insert(wallet).values({ vendorId }).onConflictDoNothing();
  }

  private async snapshot(vendorId: string, shopName: string): Promise<WalletView> {
    await this.ensureWallet(vendorId);
    const w = (await this.db.select().from(wallet).where(eq(wallet.vendorId, vendorId)))[0];
    const v = (
      await this.db
        .select({ proUntil: vendor.proUntil })
        .from(vendor)
        .where(eq(vendor.id, vendorId))
    )[0];
    const proActive = v?.proUntil != null && v.proUntil.getTime() > Date.now();
    const txs = await this.db
      .select()
      .from(walletTransaction)
      .where(eq(walletTransaction.vendorId, vendorId))
      .orderBy(desc(walletTransaction.createdAt))
      .limit(10);
    return {
      hasShop: true,
      shopName,
      balanceCents: Number(w?.balanceCents ?? 0),
      points: w?.points ?? 0,
      isPro: proActive,
      proUntil: proActive ? v!.proUntil!.toISOString() : null,
      transactions: txs.map((t) => ({
        id: t.id,
        kind: t.kind,
        amountCents: Number(t.amountCents),
        points: t.points,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  async get(token: string | null): Promise<WalletView> {
    const v = await this.vendorOf(token);
    if (!v) {
      return {
        hasShop: false,
        shopName: null,
        balanceCents: 0,
        points: 0,
        isPro: false,
        proUntil: null,
        transactions: [],
      };
    }
    return this.snapshot(v.id, v.name);
  }

  async topup(token: string | null, amountCents: number): Promise<WalletView> {
    const v = await this.requireVendor(token);
    const amount = Math.round(amountCents);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_TOPUP_CENTS) {
      throw new BadRequestException('Montante inválido.');
    }
    await this.ensureWallet(v.id);
    await this.db
      .update(wallet)
      .set({ balanceCents: sql`${wallet.balanceCents} + ${amount}`, updatedAt: sql`now()` })
      .where(eq(wallet.vendorId, v.id));
    await this.db.insert(walletTransaction).values({
      vendorId: v.id,
      kind: 'topup',
      amountCents: amount,
      points: 0,
      description: 'Carregamento de saldo',
    });
    return this.snapshot(v.id, v.name);
  }

  async purchase(token: string | null, packageId: string): Promise<WalletView> {
    const v = await this.requireVendor(token);
    const pkg = PACKAGES.find((p) => p.id === packageId);
    if (!pkg) throw new BadRequestException('Pacote inválido.');
    await this.ensureWallet(v.id);
    await this.db
      .update(wallet)
      .set({
        balanceCents: sql`${wallet.balanceCents} + ${pkg.balanceCents}`,
        points: sql`${wallet.points} + ${pkg.points}`,
        updatedAt: sql`now()`,
      })
      .where(eq(wallet.vendorId, v.id));
    await this.db.insert(walletTransaction).values({
      vendorId: v.id,
      kind: 'purchase',
      amountCents: pkg.balanceCents,
      points: pkg.points,
      description: pkg.name,
    });
    return this.snapshot(v.id, v.name);
  }

  /** Spend balance to promote one of the seller's own listings. */
  async boost(token: string | null, productId: string, planCode: string): Promise<BoostResult> {
    const v = await this.requireVendor(token);
    if (!productId) throw new BadRequestException('Anúncio inválido.');
    // Ownership: the listing must belong to the caller's shop.
    const owned = (
      await this.db
        .select({ id: product.id })
        .from(product)
        .where(and(eq(product.id, productId), eq(product.vendorId, v.id)))
        .limit(1)
    )[0];
    if (!owned) throw new BadRequestException('Esse anúncio não é da tua loja.');
    const plan = await this.promotions.planFor(planCode);
    if (!plan) throw new BadRequestException('Plano de destaque inválido.');
    await this.ensureWallet(v.id);
    const w = (await this.db.select().from(wallet).where(eq(wallet.vendorId, v.id)))[0];
    if (plan.kind === 'bump') {
      // "Subir ao topo" is paid with loyalty points (1 point ≈ 1 MT of price).
      const pts = pointsCostOf(plan.priceCents);
      if ((w?.points ?? 0) < pts) {
        throw new BadRequestException('Pontos insuficientes. Compra um pacote para ganhar pontos.');
      }
      await this.db
        .update(wallet)
        .set({ points: sql`${wallet.points} - ${pts}`, updatedAt: sql`now()` })
        .where(eq(wallet.vendorId, v.id));
      await this.db.insert(walletTransaction).values({
        vendorId: v.id,
        kind: 'spend',
        amountCents: 0,
        points: -pts,
        description: `Subir ao topo: ${plan.name}`,
      });
    } else {
      // "Destaque"/"Turbo" are paid with balance.
      if (Number(w?.balanceCents ?? 0) < plan.priceCents) {
        throw new BadRequestException('Saldo insuficiente. Carrega a tua conta.');
      }
      await this.db
        .update(wallet)
        .set({
          balanceCents: sql`${wallet.balanceCents} - ${plan.priceCents}`,
          updatedAt: sql`now()`,
        })
        .where(eq(wallet.vendorId, v.id));
      await this.db.insert(walletTransaction).values({
        vendorId: v.id,
        kind: 'spend',
        amountCents: -plan.priceCents,
        points: 0,
        description: `Destaque: ${plan.name}`,
      });
    }
    const applied = await this.promotions.applyToProduct(productId, planCode, 'wallet');
    return {
      wallet: await this.snapshot(v.id, v.name),
      planName: applied.planName,
      endsAt: applied.endsAt ? applied.endsAt.toISOString() : null,
    };
  }

  /** Subscribe / renew "Loja Pro" for 30 days, paid from wallet balance. */
  async subscribePro(token: string | null): Promise<WalletView> {
    const v = await this.requireVendor(token);
    await this.ensureWallet(v.id);
    const w = (await this.db.select().from(wallet).where(eq(wallet.vendorId, v.id)))[0];
    if (Number(w?.balanceCents ?? 0) < PRO_PRICE_CENTS) {
      throw new BadRequestException('Saldo insuficiente. Carrega a tua conta.');
    }
    const row = (
      await this.db.select({ proUntil: vendor.proUntil }).from(vendor).where(eq(vendor.id, v.id))
    )[0];
    const now = Date.now();
    const base =
      row?.proUntil != null && row.proUntil.getTime() > now ? row.proUntil.getTime() : now;
    const newUntil = new Date(base + PRO_DAYS * 86_400_000);
    // Charge the wallet and extend the subscription.
    await this.db
      .update(wallet)
      .set({
        balanceCents: sql`${wallet.balanceCents} - ${PRO_PRICE_CENTS}`,
        updatedAt: sql`now()`,
      })
      .where(eq(wallet.vendorId, v.id));
    await this.db.update(vendor).set({ proUntil: newUntil }).where(eq(vendor.id, v.id));
    await this.db.insert(walletTransaction).values({
      vendorId: v.id,
      kind: 'spend',
      amountCents: -PRO_PRICE_CENTS,
      points: 0,
      description: 'Loja Pro (30 dias)',
    });
    return this.snapshot(v.id, v.name);
  }

  private async requireVendor(token: string | null): Promise<{ id: string; name: string }> {
    const v = await this.vendorOf(token);
    if (!v) throw new BadRequestException('Cria a tua loja antes de usares a carteira.');
    return v;
  }
}

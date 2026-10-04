import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { wallet, walletTransaction } from '../../db/schema/wallet.js';
import { vendor, vendorUser } from '../../db/schema/vendors.js';
import { AuthService } from '../auth/auth.service.js';

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
  transactions: WalletTx[];
}

// Prepaid seller packages. Buying one credits balance (+ a bonus) and loyalty
// points. Demo payment: the balance is real and persisted, but no money moves.
const PACKAGES: readonly WalletPackage[] = [
  { id: 'basico', name: 'Pacote Básico', priceCents: 10000, balanceCents: 10000, points: 10 },
  { id: 'popular', name: 'Pacote Popular', priceCents: 50000, balanceCents: 55000, points: 60 },
  { id: 'pro', name: 'Pacote Pro', priceCents: 100000, balanceCents: 115000, points: 150 },
];

const MAX_TOPUP_CENTS = 10_000_000; // 100 000 MT per top-up

@Injectable()
export class WalletService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly auth: AuthService,
  ) {}

  packages(): readonly WalletPackage[] {
    return PACKAGES;
  }

  /** The signed-in user's shop (first vendor they own), or null. */
  private async vendorOf(
    token: string | null,
  ): Promise<{ id: string; name: string } | null> {
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
      return { hasShop: false, shopName: null, balanceCents: 0, points: 0, transactions: [] };
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

  private async requireVendor(token: string | null): Promise<{ id: string; name: string }> {
    const v = await this.vendorOf(token);
    if (!v) throw new BadRequestException('Cria a tua loja antes de usares a carteira.');
    return v;
  }
}

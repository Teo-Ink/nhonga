import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { checkoutIntent } from '../../db/schema/checkout.js';
import { wallet, walletTransaction } from '../../db/schema/wallet.js';
import { MAX_TOPUP_CENTS, WalletService } from '../wallet/wallet.service.js';
import { buildCheckoutSetup, type CheckoutSetup } from './checkout.config.js';
import {
  GatewayUnavailableError,
  PAY_METHODS,
  type CheckoutGateway,
  type FetchLike,
  type GatewayId,
  type PayMethod,
} from './checkout.types.js';

export const CHECKOUT_SETUP = Symbol('CHECKOUT_SETUP');

/** Unpaid intents give up after this long (PawaPay's page itself lasts 15 min). */
export const INTENT_TTL_MS = 30 * 60_000;
const MIN_TOPUP_CENTS = 1_000; // 10 MT
const MAX_OPEN_PER_VENDOR = 5;
const SWEEP_EVERY_MS = 60_000;

export interface CheckoutView {
  id: string;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'review';
  purpose: string;
  amountCents: number;
  method: string;
  gateway: string;
  checkoutUrl: string | null;
  failureReason: string | null;
  createdAt: string;
  paidAt: string | null;
}

type Intent = typeof checkoutIntent.$inferSelect;

export function checkoutSetupFromEnv(): CheckoutSetup {
  return buildCheckoutSetup(process.env, fetch as unknown as FetchLike);
}

/**
 * Hosted checkout: create a payment at the gateway, send the buyer to its page,
 * and credit the wallet exactly once when the gateway confirms.
 *
 * - Webhooks are hints; the outcome always comes from the gateway's status API.
 * - Settlement is a single conditional UPDATE (pending/expired → paid) in the
 *   same transaction as the wallet credit, so a webhook, a poll and the sweep
 *   racing each other still credit once.
 * - A paid amount that differs from the intent goes to 'review', not the wallet.
 * - If the primary gateway is unreachable (network/5xx), the backup is tried.
 */
@Injectable()
export class CheckoutService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Checkout');
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly wallets: WalletService,
    @Inject(CHECKOUT_SETUP) private readonly setup: CheckoutSetup,
  ) {}

  onModuleInit(): void {
    this.log.log(`mode=${this.setup.mode} gateways=${this.setup.chain.map((g) => g.id).join('→')}`);
    this.sweepTimer = setInterval(() => void this.sweep(), SWEEP_EVERY_MS);
    this.sweepTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  /** Which wallets can be offered right now (for the method picker). */
  methods(): { mode: string; methods: PayMethod[] } {
    const set = new Set<PayMethod>();
    for (const g of this.setup.chain) for (const m of g.methods) set.add(m);
    return { mode: this.setup.mode, methods: PAY_METHODS.filter((m) => set.has(m)) };
  }

  async startTopup(
    token: string | null,
    amountCents: number,
    method: string,
  ): Promise<CheckoutView> {
    if (!token) throw new UnauthorizedException('Inicia sessão para carregar a carteira.');
    const shop = await this.wallets.requireShop(token);
    const amount = Math.round(amountCents);
    if (!Number.isFinite(amount) || amount < MIN_TOPUP_CENTS || amount > MAX_TOPUP_CENTS) {
      throw new BadRequestException('Montante inválido (mínimo 10 MT, máximo 100 000 MT).');
    }
    if (!PAY_METHODS.includes(method as PayMethod)) {
      throw new BadRequestException('Método de pagamento inválido.');
    }
    const payMethod = method as PayMethod;
    const candidates = this.setup.chain.filter((g) => g.methods.includes(payMethod));
    if (candidates.length === 0) {
      throw new BadRequestException('Esse método de pagamento ainda não está disponível.');
    }

    const open = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(checkoutIntent)
      .where(
        and(
          eq(checkoutIntent.vendorId, shop.id),
          eq(checkoutIntent.status, 'pending'),
          sql`${checkoutIntent.createdAt} > now() - interval '30 minutes'`,
        ),
      );
    if ((open[0]?.n ?? 0) >= MAX_OPEN_PER_VENDOR) {
      throw new BadRequestException(
        'Tens pagamentos por concluir. Termina-os ou espera alguns minutos.',
      );
    }

    const id = randomUUID();
    const first = candidates[0] as CheckoutGateway;
    await this.db.insert(checkoutIntent).values({
      id,
      purpose: 'wallet_topup',
      vendorId: shop.id,
      amountCents: amount,
      method: payMethod,
      gateway: first.id,
    });

    let lastError: unknown = null;
    for (const gw of candidates) {
      try {
        const created = await gw.create({
          intentId: id,
          amountCents: amount,
          method: payMethod,
          description: 'Carregamento Nhonga',
          returnUrl: `${this.setup.publicWebUrl}/pagamento/${id}`,
          webhookUrl: `${this.setup.publicApiUrl}/checkout/webhooks/${gw.id}`,
        });
        const [row] = await this.db
          .update(checkoutIntent)
          .set({
            gateway: gw.id,
            gatewayRef: created.gatewayRef,
            checkoutUrl: created.checkoutUrl,
            updatedAt: sql`now()`,
          })
          .where(eq(checkoutIntent.id, id))
          .returning();
        if (gw !== first) this.log.warn(`intent ${id}: ${first.id} unavailable, used ${gw.id}`);
        return view(row as Intent);
      } catch (e) {
        lastError = e;
        if (e instanceof GatewayUnavailableError) {
          this.log.warn(`intent ${id}: ${e.message}; trying next gateway`);
          continue;
        }
        break; // a rejected request would be rejected by the backup too
      }
    }
    await this.db
      .update(checkoutIntent)
      .set({ status: 'failed', failureReason: errText(lastError), updatedAt: sql`now()` })
      .where(eq(checkoutIntent.id, id));
    this.log.error(`intent ${id}: could not start payment: ${errText(lastError)}`);
    throw new ServiceUnavailableException(
      'Não foi possível iniciar o pagamento agora. Tenta de novo dentro de instantes.',
    );
  }

  /** The caller's own intent, refreshed from the gateway while still pending. */
  async get(token: string | null, id: string): Promise<CheckoutView> {
    if (!token) throw new UnauthorizedException('Inicia sessão.');
    const shop = await this.wallets.requireShop(token);
    const intent = await this.find(id);
    if (!intent || intent.vendorId !== shop.id)
      throw new NotFoundException('Pagamento não encontrado.');
    return view(intent.status === 'pending' ? await this.refresh(intent) : intent);
  }

  /**
   * Gateway callback. Returns 'ok' for anything we could act on or safely
   * ignore (unknown refs, already settled), so gateways stop retrying; throws
   * 401 on a bad signature.
   */
  async handleWebhook(
    gatewayId: string,
    headers: Readonly<Record<string, string | undefined>>,
    rawBody: string,
  ): Promise<'ok'> {
    const gw = this.setup.byId.get(gatewayId as GatewayId);
    if (!gw) throw new NotFoundException();
    const parsed = gw.parseWebhook({ headers, rawBody });
    if (!parsed.valid) {
      this.log.warn(`webhook ${gatewayId}: ${parsed.reason}`);
      if (parsed.reason === 'bad_signature') throw new UnauthorizedException();
      return 'ok';
    }
    const intent = (
      await this.db
        .select()
        .from(checkoutIntent)
        .where(
          and(eq(checkoutIntent.gateway, gw.id), eq(checkoutIntent.gatewayRef, parsed.gatewayRef)),
        )
        .limit(1)
    )[0];
    if (!intent) {
      this.log.warn(`webhook ${gatewayId}: unknown ref ${parsed.gatewayRef}`);
      return 'ok';
    }
    // A late payment on an expired intent still has to be credited.
    if (intent.status === 'pending' || intent.status === 'expired')
      await this.refresh(intent, true);
    return 'ok';
  }

  /** Dev simulator: approve or decline a mock payment (mock mode only). */
  async mockDecide(
    token: string | null,
    id: string,
    outcome: 'paid' | 'failed',
  ): Promise<CheckoutView> {
    if (!this.setup.mock) throw new ForbiddenException('Simulador indisponível.');
    if (!token) throw new UnauthorizedException('Inicia sessão.');
    const shop = await this.wallets.requireShop(token);
    const intent = await this.find(id);
    if (!intent || intent.vendorId !== shop.id || !intent.gatewayRef) {
      throw new NotFoundException('Pagamento não encontrado.');
    }
    this.setup.mock.decide(intent.gatewayRef, outcome);
    return view(intent.status === 'pending' ? await this.refresh(intent) : intent);
  }

  /** Reconcile pending intents whose callback we may have missed. */
  async sweep(): Promise<number> {
    let n = 0;
    try {
      const rows = await this.db
        .select()
        .from(checkoutIntent)
        .where(
          and(
            eq(checkoutIntent.status, 'pending'),
            lt(checkoutIntent.createdAt, sql`now() - interval '1 minute'`),
          ),
        )
        .orderBy(checkoutIntent.createdAt)
        .limit(50);
      for (const r of rows) {
        await this.refresh(r).catch((e) => this.log.warn(`sweep ${r.id}: ${errText(e)}`));
        n++;
      }
    } catch (e) {
      this.log.warn(`sweep failed: ${errText(e)}`);
    }
    return n;
  }

  private async find(id: string): Promise<Intent | undefined> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
    return (
      await this.db.select().from(checkoutIntent).where(eq(checkoutIntent.id, id)).limit(1)
    )[0];
  }

  /** Ask the gateway, then settle / fail / expire. Never throws on gateway outages. */
  private async refresh(intent: Intent, allowExpired = false): Promise<Intent> {
    const gw = this.setup.byId.get(intent.gateway as GatewayId);
    const expired = Date.now() - intent.createdAt.getTime() > INTENT_TTL_MS;
    if (!gw || !intent.gatewayRef) {
      return expired ? this.transition(intent, 'expired', 'Sem resposta do gateway') : intent;
    }
    let s;
    try {
      s = await gw.status(intent.gatewayRef, intent.createdAt);
    } catch (e) {
      this.log.warn(`status ${intent.id}: ${errText(e)}`);
      return intent; // try again on the next poll / sweep
    }
    if (s.status === 'paid') {
      return this.settle(intent, s.amountCents, allowExpired);
    }
    if (s.status === 'failed') return this.transition(intent, 'failed', s.failureReason);
    return expired ? this.transition(intent, 'expired', 'Tempo esgotado') : intent;
  }

  private async transition(
    intent: Intent,
    to: 'failed' | 'expired',
    reason: string | null,
  ): Promise<Intent> {
    const [row] = await this.db
      .update(checkoutIntent)
      .set({ status: to, failureReason: reason, updatedAt: sql`now()` })
      .where(and(eq(checkoutIntent.id, intent.id), eq(checkoutIntent.status, 'pending')))
      .returning();
    return row ?? ((await this.find(intent.id)) as Intent);
  }

  /** Exactly-once credit: the status flip and the wallet credit commit together. */
  private async settle(
    intent: Intent,
    paidCents: number | null,
    allowExpired: boolean,
  ): Promise<Intent> {
    const amountOk = paidCents === null || paidCents === Number(intent.amountCents);
    const from = allowExpired ? ['pending', 'expired'] : ['pending'];
    const row = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(checkoutIntent)
        .set({
          status: amountOk ? 'paid' : 'review',
          paidAt: sql`now()`,
          failureReason: amountOk ? null : `Montante recebido ${paidCents} ≠ ${intent.amountCents}`,
          updatedAt: sql`now()`,
        })
        .where(and(eq(checkoutIntent.id, intent.id), inArray(checkoutIntent.status, from)))
        .returning();
      if (!updated) return null; // someone else settled it first
      if (amountOk && updated.purpose === 'wallet_topup' && updated.vendorId) {
        await tx.insert(wallet).values({ vendorId: updated.vendorId }).onConflictDoNothing();
        await tx
          .update(wallet)
          .set({
            balanceCents: sql`${wallet.balanceCents} + ${updated.amountCents}`,
            updatedAt: sql`now()`,
          })
          .where(eq(wallet.vendorId, updated.vendorId));
        await tx.insert(walletTransaction).values({
          vendorId: updated.vendorId,
          kind: 'topup',
          amountCents: updated.amountCents,
          points: 0,
          description: `Carregamento ${methodLabel(updated.method)}`,
        });
      }
      return updated;
    });
    if (row) {
      if (row.status === 'review')
        this.log.error(`intent ${row.id} needs review: ${row.failureReason}`);
      else this.log.log(`intent ${row.id} paid via ${row.gateway}`);
      return row;
    }
    return (await this.find(intent.id)) as Intent;
  }
}

function methodLabel(m: string): string {
  return { mpesa: 'M-Pesa', emola: 'e-Mola', mkesh: 'mKesh', card: 'cartão' }[m] ?? m;
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function view(i: Intent): CheckoutView {
  return {
    id: i.id,
    status: i.status as CheckoutView['status'],
    purpose: i.purpose,
    amountCents: Number(i.amountCents),
    method: i.method,
    gateway: i.gateway,
    checkoutUrl: i.status === 'pending' ? i.checkoutUrl : null,
    failureReason: i.failureReason,
    createdAt: i.createdAt.toISOString(),
    paidAt: i.paidAt ? i.paidAt.toISOString() : null,
  };
}

import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { CheckoutOut, RefundOut } from '@nhonga/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { checkoutIntent } from '../../db/schema/checkout.js';
import { vendor } from '../../db/schema/vendors.js';
import { wallet, walletTransaction } from '../../db/schema/wallet.js';
import type { Db } from '../../db/types.js';
import { hasTestDb, migrateTestDb, openTestDb } from '../../test/pg.js';
import type { WalletService } from '../wallet/wallet.service.js';
import type { CheckoutSetup } from './checkout.config.js';
import { CheckoutService } from './checkout.service.js';
import {
  GatewayUnavailableError,
  type CheckoutGateway,
  type CreateCheckoutInput,
  type GatewayId,
  type GatewayStatus,
  type PayMethod,
  type RefundInput,
  type RefundResult,
} from './checkout.types.js';

// TEST-02: the money path of the hosted checkout against a real Postgres:
// exactly-once credit under duplicate/concurrent callbacks, amount mismatch,
// a late payment after expiry, failures and failover between gateways.

/** A gateway whose answers the test controls. */
class FakeGateway implements CheckoutGateway {
  readonly methods: readonly PayMethod[] = ['mpesa', 'emola', 'card'];
  readonly answers = new Map<string, GatewayStatus>();
  down = false;
  created = 0;
  constructor(readonly id: GatewayId) {}
  async create(input: CreateCheckoutInput) {
    if (this.down) throw new GatewayUnavailableError(this.id, 'connection refused');
    this.created++;
    const ref = `${this.id}-${input.intentId}`;
    this.answers.set(ref, { status: 'pending', amountCents: null, failureReason: null });
    return { gatewayRef: ref, checkoutUrl: `https://pay.example/${ref}` };
  }
  async status(ref: string) {
    return this.answers.get(ref) ?? { status: 'pending', amountCents: null, failureReason: null };
  }
  parseWebhook({ rawBody }: { rawBody: string }) {
    return { valid: true as const, gatewayRef: (JSON.parse(rawBody) as { ref: string }).ref };
  }
  pay(ref: string, amountCents: number) {
    this.answers.set(ref, { status: 'paid', amountCents, failureReason: null });
  }
  refundAnswer: RefundResult = { status: 'completed', reason: null };
  refunds: RefundInput[] = [];
  async refund(input: RefundInput): Promise<RefundResult> {
    this.refunds.push(input);
    return this.refundAnswer;
  }
}

describe.skipIf(!hasTestDb)('CheckoutService (Postgres)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let primary: FakeGateway;
  let backup: FakeGateway;
  let svc: CheckoutService;
  let vendorId: string;

  const walletRow = async () =>
    (await db.select().from(wallet).where(eq(wallet.vendorId, vendorId)))[0];
  const txCount = async () =>
    (await db.select().from(walletTransaction).where(eq(walletTransaction.vendorId, vendorId)))
      .length;
  const webhook = (gw: FakeGateway, ref: string) =>
    svc.handleWebhook(gw.id, {}, JSON.stringify({ ref }));

  beforeAll(() => {
    migrateTestDb();
    ({ db, close } = openTestDb());
  });
  afterAll(async () => close());

  beforeEach(async () => {
    vendorId = randomUUID();
    await db.insert(vendor).values({
      id: vendorId,
      slug: `test-${vendorId.slice(0, 8)}`,
      legalName: 'Loja de Teste',
      displayName: 'Loja de Teste',
      vendorType: 'individual',
      status: 'active',
    } as typeof vendor.$inferInsert);
    primary = new FakeGateway('pawapay');
    backup = new FakeGateway('paysuite');
    const setup: CheckoutSetup = {
      mode: 'live',
      chain: [primary, backup],
      byId: new Map<GatewayId, CheckoutGateway>([
        ['pawapay', primary],
        ['paysuite', backup],
      ]),
      mock: null,
      publicApiUrl: 'https://api.test',
      publicWebUrl: 'https://web.test',
    };
    const wallets = { requireShop: async () => ({ id: vendorId }) } as unknown as WalletService;
    svc = new CheckoutService(db, wallets, setup);
  });

  it('credits a top-up exactly once under 10 concurrent callbacks', async () => {
    const v = await svc.startTopup('token', 50_000, 'mpesa');
    expect(() => CheckoutOut.parse(v)).not.toThrow(); // matches the OpenAPI response
    const ref = `pawapay-${v.id}`;
    primary.pay(ref, 50_000);

    await Promise.all(Array.from({ length: 10 }, () => webhook(primary, ref)));

    expect((await walletRow())?.balanceCents).toBe(50_000);
    expect(await txCount()).toBe(1);
    const [intent] = await db.select().from(checkoutIntent).where(eq(checkoutIntent.id, v.id));
    expect(intent?.status).toBe('paid');
  });

  it('sends an amount mismatch to review without crediting', async () => {
    const v = await svc.startTopup('token', 50_000, 'emola');
    const ref = `pawapay-${v.id}`;
    primary.pay(ref, 5_000); // gateway reports less than was requested

    await webhook(primary, ref);

    const [intent] = await db.select().from(checkoutIntent).where(eq(checkoutIntent.id, v.id));
    expect(intent?.status).toBe('review');
    expect(await walletRow()).toBeUndefined();
    expect(await txCount()).toBe(0);
  });

  it('still credits a payment that arrives after the intent expired', async () => {
    const v = await svc.startTopup('token', 20_000, 'mpesa');
    const ref = `pawapay-${v.id}`;
    await db
      .update(checkoutIntent)
      .set({ status: 'expired', createdAt: sql`now() - interval '2 hours'` })
      .where(eq(checkoutIntent.id, v.id));
    primary.pay(ref, 20_000);

    await webhook(primary, ref);

    expect((await walletRow())?.balanceCents).toBe(20_000);
    const [intent] = await db.select().from(checkoutIntent).where(eq(checkoutIntent.id, v.id));
    expect(intent?.status).toBe('paid');
  });

  it('records a failure without crediting', async () => {
    const v = await svc.startTopup('token', 20_000, 'mpesa');
    const ref = `pawapay-${v.id}`;
    primary.answers.set(ref, { status: 'failed', amountCents: null, failureReason: 'Saldo' });

    await webhook(primary, ref);

    const [intent] = await db.select().from(checkoutIntent).where(eq(checkoutIntent.id, v.id));
    expect(intent?.status).toBe('failed');
    expect(await walletRow()).toBeUndefined();
  });

  it('fails over to the backup gateway when the primary is unreachable', async () => {
    primary.down = true;
    const v = await svc.startTopup('token', 20_000, 'mpesa');
    expect(v.gateway).toBe('paysuite');
    expect(backup.created).toBe(1);
  });

  it('ignores callbacks for unknown payments', async () => {
    await expect(webhook(primary, 'pawapay-unknown')).resolves.toBe('ok');
  });

  it('credits a package with its bonus and points once', async () => {
    const v = await svc.startPackage('token', 'popular', 'mpesa');
    const ref = `pawapay-${v.id}`;
    primary.pay(ref, v.amountCents);

    await Promise.all([webhook(primary, ref), webhook(primary, ref), svc.sweep()]);

    const w = await walletRow();
    expect(w?.balanceCents).toBe(55_000); // 500 MT paid -> 550 MT credited
    expect(w?.points).toBe(60);
    expect(await txCount()).toBe(1);
  });

  // P2-02: refunds.
  const paidTopup = async (cents: number) => {
    const v = await svc.startTopup('token', cents, 'mpesa');
    primary.pay(`pawapay-${v.id}`, cents);
    await webhook(primary, `pawapay-${v.id}`);
    return v.id;
  };

  it('refunds a top-up once: takes the credit back and returns the money', async () => {
    const id = await paidTopup(30_000);
    const [a, b] = await Promise.all([
      svc.refund(id, 'pedido do cliente'),
      svc.refund(id, 'duplo'),
    ]);
    expect([a.refundStatus, b.refundStatus]).toContain('refunded');
    expect(() => RefundOut.parse(a)).not.toThrow(); // matches the OpenAPI response
    expect(primary.refunds).toEqual([
      { refundId: id, gatewayRef: `pawapay-${id}`, amountCents: 30_000 },
    ]);
    expect((await walletRow())?.balanceCents).toBe(0);
    const kinds = (
      await db.select().from(walletTransaction).where(eq(walletTransaction.vendorId, vendorId))
    ).map((t) => t.kind);
    expect(kinds.sort()).toEqual(['refund', 'topup']);
  });

  it('refuses when the credit was already spent', async () => {
    const id = await paidTopup(30_000);
    await db.update(wallet).set({ balanceCents: 1_000 }).where(eq(wallet.vendorId, vendorId));
    await expect(svc.refund(id, 'x')).rejects.toMatchObject({ status: 409 });
    expect(primary.refunds).toHaveLength(0);
    const [intent] = await db.select().from(checkoutIntent).where(eq(checkoutIntent.id, id));
    expect(intent?.refundStatus).toBeNull();
  });

  it('puts the credit back when the gateway refuses', async () => {
    const id = await paidTopup(30_000);
    primary.refundAnswer = { status: 'rejected', reason: 'saldo da conta insuficiente' };
    await expect(svc.refund(id, 'x')).rejects.toMatchObject({ status: 409 });
    expect((await walletRow())?.balanceCents).toBe(30_000);
    const [intent] = await db.select().from(checkoutIntent).where(eq(checkoutIntent.id, id));
    expect(intent?.refundStatus).toBe('failed');
  });

  it('refunds a payment in review without touching the wallet', async () => {
    const v = await svc.startTopup('token', 50_000, 'emola');
    primary.pay(`pawapay-${v.id}`, 5_000);
    await webhook(primary, `pawapay-${v.id}`);
    primary.refundAnswer = { status: 'accepted', reason: null };
    const r = await svc.refund(v.id, 'valor errado');
    expect(r.refundStatus).toBe('pending');
    expect(await walletRow()).toBeUndefined();
  });

  it('only refunds received payments', async () => {
    const v = await svc.startTopup('token', 10_000, 'mpesa');
    await expect(svc.refund(v.id, 'x')).rejects.toMatchObject({ status: 409 });
    await expect(svc.refund(randomUUID(), 'x')).rejects.toMatchObject({ status: 404 });
  });
});

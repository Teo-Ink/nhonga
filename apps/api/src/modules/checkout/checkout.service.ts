/**
 * Checkout.
 *
 * The single most important code path in the system. It turns a cart into an order, reserves
 * stock, and initiates payment — and it is the place where getting concurrency or transaction
 * boundaries wrong costs real money.
 *
 * Three decisions are load-bearing, and each is enforced here rather than merely documented:
 *
 *   1. **One database transaction** covers stock validation, stock reservation, order creation,
 *      payment creation, and the outbox write. Either all of it happened or none of it did.
 *
 *   2. **The provider call happens after that transaction commits.** Holding row locks across a
 *      network call to Vodacom would pin them for the duration of an unpredictable external
 *      request — the classic way to take down a database under load.
 *
 *   3. **Stock is reserved at order creation, not at payment confirmation.** Reserving on
 *      creation can strand stock when payment fails; reserving on confirmation oversells.
 *      Overselling is worse — it breaks a promise already made to a buyer. Stranded stock is
 *      released by a worker when the payment reaches FAILED or EXPIRED.
 *
 * See docs/phase-2-architecture/01-system-architecture.md §3.
 */

import type { Db, Tx } from '../../db/types.js';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  cents,
  computeCartTotals,
  distributeDiscount,
  normaliseMzMsisdn,
  type CartLine,
  type Cents,
} from '@nhonga/shared';
import { product, productVariant, stockLedger } from '../../db/schema/catalog.js';
import {
  order as orderTable,
  orderItem,
  payment as paymentTable,
  subOrder as subOrderTable,
  type AddressSnapshot,
  type ProductSnapshot,
} from '../../db/schema/commerce.js';
import { address as addressTable, district, province } from '../../db/schema/identity.js';
import { vendor as vendorTable } from '../../db/schema/vendors.js';
import { outbox } from '../../db/schema/platform.js';
import type { PaymentProvider, ProviderId } from '../payments/payment-provider.interface.js';

export type CheckoutErrorCode =
  | 'cart_empty'
  | 'address_not_found'
  | 'insufficient_stock'
  | 'price_changed'
  | 'total_mismatch'
  | 'vendor_unavailable'
  | 'variant_unavailable'
  | 'invalid_msisdn'
  | 'provider_unavailable';

export class CheckoutError extends Error {
  readonly code: CheckoutErrorCode;
  /** Already localised and safe to show the buyer. */
  readonly userMessage: string;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: CheckoutErrorCode,
    userMessage: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(`${code}: ${userMessage}`);
    this.name = 'CheckoutError';
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;
  }
}

export interface CheckoutRequest {
  readonly userId: string;
  readonly cartLines: readonly CartCandidate[];
  readonly addressId: string;
  readonly deliveryMethod: 'marketplace' | 'vendor' | 'pickup';
  readonly paymentProvider: ProviderId;
  readonly paymentMsisdn: string | null;
  /** What the buyer was shown. If the server no longer agrees, we refuse rather than silently
   *  charging a different amount than the one on their screen. */
  readonly expectedTotalCents: Cents;
  readonly idempotencyKey: string;
}

/** A cart line as read from the cart module, before validation against live catalogue state. */
export interface CartCandidate {
  readonly cartItemId: string;
  readonly variantId: string;
  readonly quantity: number;
}

export interface CheckoutResult {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly paymentId: string;
  readonly paymentStatus: 'awaiting_user' | 'failed';
  readonly providerTxId: string | null;
  readonly expiresAt: Date;
  readonly failure: {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
  } | null;
}

export interface ShippingQuoter {
  /** Per-vendor delivery fee and window for a district. Keys strictly off district — free text
   *  never enters a calculation (D-10). */
  quote(input: {
    readonly vendorId: string;
    readonly districtId: string;
    readonly method: 'marketplace' | 'vendor' | 'pickup';
    readonly weightGrams: number;
    readonly itemsTotalCents: Cents;
  }): Promise<{ feeCents: Cents; minDays: number; maxDays: number }>;
}

export interface OrderNumberGenerator {
  next(): Promise<string>;
}

/** Narrow surface so this service can be unit-tested without a database. */
export interface CheckoutDeps {
  readonly db: Db;
  readonly shipping: ShippingQuoter;
  readonly orderNumbers: OrderNumberGenerator;
  readonly providers: ReadonlyMap<ProviderId, PaymentProvider>;
  readonly approvalTimeoutSeconds: number;
  readonly lateSweepHours: number;
  /**
   * Envelope encryption for PII columns, backed by KMS.
   *
   * A required dependency rather than an importable helper with a default, specifically so it
   * cannot ship as a silent no-op — a stubbed encryptor that returns its input would look
   * correct in review and store plaintext MSISDNs in production.
   */
  readonly encryptField: (plaintext: string) => string;
  /** Schedules reconciliation immediately at order creation, so resolution never depends on the
   *  webhook arriving, on the client staying connected, or on the user returning (D-23). */
  readonly scheduleReconciliation: (paymentId: string) => Promise<void>;
}

interface ValidatedLine {
  readonly cartItemId: string;
  readonly variantId: string;
  readonly productId: string;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly quantity: number;
  readonly unitPriceCents: Cents;
  readonly weightGrams: number;
  readonly snapshot: ProductSnapshot;
}

export class CheckoutService {
  private readonly deps: CheckoutDeps;

  constructor(deps: CheckoutDeps) {
    this.deps = deps;
  }

  async placeOrder(request: CheckoutRequest): Promise<CheckoutResult> {
    if (request.cartLines.length === 0) {
      throw new CheckoutError('cart_empty', 'O seu carrinho está vazio.');
    }

    const provider = this.deps.providers.get(request.paymentProvider);
    if (provider === undefined) {
      throw new CheckoutError(
        'provider_unavailable',
        'Este método de pagamento não está disponível de momento.',
        { provider: request.paymentProvider },
      );
    }

    const payerMsisdn = this.resolvePayerMsisdn(request, provider);

    // ── Phase 1: everything that must be atomic ──────────────────────────────
    const prepared = await this.deps.db.transaction(async (tx: Tx) =>
      this.prepareOrder(tx, request, payerMsisdn),
    );

    // ── Phase 2: the external call, deliberately outside the transaction ─────
    const requested = await provider.requestPayment({
      paymentId: prepared.paymentId,
      idempotencyKey: request.idempotencyKey,
      amountCents: prepared.grandTotalCents,
      currency: 'MZN',
      payerMsisdn,
      reference: prepared.providerRef,
      description: `Pedido #${prepared.orderNumber}`,
    });

    if (requested.outcome === 'rejected') {
      // The order exists and stock is reserved. The buyer can retry or switch rails; a worker
      // releases the stock if they do neither. We do not roll the order back here — a vanished
      // order is far more alarming to a buyer than a failed payment they can retry.
      await this.markPaymentFailed(prepared.paymentId, requested.code, requested.message);
      return {
        orderId: prepared.orderId,
        orderNumber: prepared.orderNumber,
        paymentId: prepared.paymentId,
        paymentStatus: 'failed',
        providerTxId: null,
        expiresAt: prepared.expiresAt,
        failure: {
          code: requested.code,
          message: requested.message,
          retryable: requested.retryable,
        },
      };
    }

    await this.markPaymentAwaiting(prepared.paymentId, requested.providerTxId, requested.expiresAt);
    await this.deps.scheduleReconciliation(prepared.paymentId);

    return {
      orderId: prepared.orderId,
      orderNumber: prepared.orderNumber,
      paymentId: prepared.paymentId,
      paymentStatus: 'awaiting_user',
      providerTxId: requested.providerTxId,
      expiresAt: requested.expiresAt,
      failure: null,
    };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private resolvePayerMsisdn(request: CheckoutRequest, provider: PaymentProvider): string {
    if (!provider.capabilities.requiresUserApproval) {
      // COD: nothing is pushed to a handset, but we still record a contact number.
      return request.paymentMsisdn ?? '';
    }
    const raw = request.paymentMsisdn;
    if (raw === null || raw === '') {
      throw new CheckoutError('invalid_msisdn', 'Indique o número de telemóvel para o pagamento.');
    }
    const normalised = normaliseMzMsisdn(raw);
    if (normalised === null) {
      throw new CheckoutError('invalid_msisdn', 'O número deve ter 9 dígitos e começar por 8.', {
        provided: raw,
      });
    }
    return normalised;
  }

  /**
   * The atomic part.
   *
   * Runs inside `db.transaction`. Every failure here rolls back cleanly, which is why stock can
   * be decremented before we know whether the provider will accept the request.
   */
  private async prepareOrder(tx: Tx, request: CheckoutRequest, payerMsisdn: string) {
    const deliveryAddress = await this.loadAddress(tx, request.userId, request.addressId);

    const validated = await this.lockAndValidate(tx, request.cartLines);

    const cartLines: CartLine[] = validated.map((line) => ({
      lineId: line.cartItemId,
      vendorId: line.vendorId,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
    }));

    // Provisional totals, so shipping can be quoted per vendor against real subtotals.
    const provisional = computeCartTotals(cartLines);

    const shippingQuotes = new Map<string, { feeCents: Cents; minDays: number; maxDays: number }>();
    for (const group of provisional.groups) {
      const weightGrams = validated
        .filter((line) => line.vendorId === group.vendorId)
        .reduce((total, line) => total + line.weightGrams * line.quantity, 0);

      const quote = await this.deps.shipping.quote({
        vendorId: group.vendorId,
        districtId: deliveryAddress.districtId,
        method: request.deliveryMethod,
        weightGrams,
        itemsTotalCents: group.itemsTotalCents,
      });
      shippingQuotes.set(group.vendorId, quote);
    }

    const totals = computeCartTotals(
      cartLines,
      Array.from(shippingQuotes.entries()).map(([vendorId, quote]) => ({
        vendorId,
        feeCents: quote.feeCents,
      })),
    );

    // The buyer is charged what the buyer was shown, or nothing at all.
    if (totals.grandTotalCents !== request.expectedTotalCents) {
      throw new CheckoutError(
        'total_mismatch',
        'O total mudou desde que viu o resumo. Verifique e tente novamente.',
        { shown: request.expectedTotalCents, actual: totals.grandTotalCents },
      );
    }

    const discountShares = distributeDiscount(totals.discountCents, cartLines);

    const orderId = randomUUID();
    const orderNumber = await this.deps.orderNumbers.next();
    const paymentId = randomUUID();
    const providerRef = `NHONGA-${orderNumber}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.deps.approvalTimeoutSeconds * 1000);

    await tx.insert(orderTable).values({
      id: orderId,
      orderNumber,
      userId: request.userId,
      addressId: deliveryAddress.id,
      addressSnapshot: deliveryAddress.snapshot,
      itemsTotalCents: totals.itemsTotalCents,
      shippingTotalCents: totals.shippingTotalCents,
      paymentFeeCents: totals.paymentFeeCents,
      discountCents: totals.discountCents,
      grandTotalCents: totals.grandTotalCents,
      currency: 'MZN',
      placedAt: now,
    });

    let suffixIndex = 0;
    for (const group of totals.groups) {
      const quote = shippingQuotes.get(group.vendorId);
      const subOrderId = randomUUID();
      const suffix = String.fromCharCode(65 + suffixIndex); // A, B, C…
      suffixIndex += 1;

      await tx.insert(subOrderTable).values({
        id: subOrderId,
        orderId,
        vendorId: group.vendorId,
        subOrderNumber: `${orderNumber}-${suffix}`,
        status: 'awaiting_payment',
        itemsTotalCents: group.itemsTotalCents,
        shippingCents: group.shippingCents,
        deliveryMethod: request.deliveryMethod,
        estimatedMinDays: quote?.minDays ?? null,
        estimatedMaxDays: quote?.maxDays ?? null,
      });

      for (const line of validated.filter((candidate) => candidate.vendorId === group.vendorId)) {
        await tx.insert(orderItem).values({
          id: randomUUID(),
          subOrderId,
          variantId: line.variantId,
          productSnapshot: line.snapshot,
          unitPriceCents: line.unitPriceCents,
          quantity: line.quantity,
          lineTotalCents: cents(line.unitPriceCents * line.quantity),
          discountCents: discountShares.get(line.cartItemId) ?? 0,
        });
      }
    }

    // Reserve stock. The database's own CHECK (stock_quantity >= 0) is the backstop — if this
    // arithmetic is ever wrong, the transaction fails rather than overselling.
    for (const line of validated) {
      // Expressed as SQL rather than read-modify-write: the decrement happens in the database,
      // against the row we already hold a lock on, and the CHECK constraint refuses it if the
      // result would be negative.
      await tx
        .update(productVariant)
        .set({
          stockQuantity: sql`${productVariant.stockQuantity} - ${line.quantity}`,
        })
        .where(eq(productVariant.id, line.variantId));

      await tx.insert(stockLedger).values({
        id: randomUUID(),
        variantId: line.variantId,
        delta: -line.quantity,
        reason: 'order_reserve',
        referenceId: orderId,
        actorId: request.userId,
      });
    }

    await tx.insert(paymentTable).values({
      id: paymentId,
      orderId,
      provider: request.paymentProvider,
      msisdnEncrypted: payerMsisdn === '' ? null : this.deps.encryptField(payerMsisdn),
      amountCents: totals.grandTotalCents,
      currency: 'MZN',
      status: 'initiated',
      providerRef,
      idempotencyKey: request.idempotencyKey,
      attemptNumber: 1,
      initiatedAt: now,
      expiresAt,
      reconcileUntil: new Date(now.getTime() + this.deps.lateSweepHours * 3600 * 1000),
    });

    await tx.insert(outbox).values({
      id: randomUUID(),
      aggregateType: 'order',
      aggregateId: orderId,
      eventType: 'order.created',
      sequence: 1,
      payload: {
        orderId,
        orderNumber,
        userId: request.userId,
        grandTotalCents: totals.grandTotalCents,
        vendorIds: totals.groups.map((group) => group.vendorId),
      },
    });

    return {
      orderId,
      orderNumber,
      paymentId,
      providerRef,
      grandTotalCents: totals.grandTotalCents,
      expiresAt,
    };
  }

  /**
   * Lock every variant in the cart, then validate.
   *
   * Locks are acquired in a single statement ordered by variant id. Ordering matters: two buyers
   * with overlapping carts acquiring locks in different orders deadlock, and a deadlock at
   * checkout surfaces to a buyer as an unexplained failure at the worst possible moment.
   */
  private async lockAndValidate(
    tx: Tx,
    candidates: readonly CartCandidate[],
  ): Promise<ValidatedLine[]> {
    const variantIds = Array.from(new Set(candidates.map((line) => line.variantId))).sort();

    const rows = await tx
      .select({
        variantId: productVariant.id,
        productId: productVariant.productId,
        sku: productVariant.sku,
        options: productVariant.options,
        priceCents: productVariant.priceCents,
        stockQuantity: productVariant.stockQuantity,
        variantActive: productVariant.isActive,
        productStatus: product.status,
        productTitle: product.titlePt,
        weightGrams: product.weightGrams,
        vendorId: product.vendorId,
        vendorName: vendorTable.displayName,
        vendorStatus: vendorTable.status,
      })
      .from(productVariant)
      .innerJoin(product, eq(product.id, productVariant.productId))
      .innerJoin(vendorTable, eq(vendorTable.id, product.vendorId))
      .where(inArray(productVariant.id, variantIds))
      .orderBy(productVariant.id)
      .for('update', { of: productVariant });

    const byId = new Map<string, (typeof rows)[number]>();
    for (const row of rows) byId.set(row.variantId, row);

    const validated: ValidatedLine[] = [];

    for (const candidate of candidates) {
      const row = byId.get(candidate.variantId);

      if (row === undefined || row.variantActive !== true || row.productStatus !== 'active') {
        throw new CheckoutError(
          'variant_unavailable',
          'Um dos produtos já não está disponível. Remova-o e tente novamente.',
          { variantId: candidate.variantId },
        );
      }

      if (row.vendorStatus !== 'active') {
        throw new CheckoutError(
          'vendor_unavailable',
          `A loja ${String(row.vendorName)} não está a aceitar encomendas de momento.`,
          { vendorId: row.vendorId },
        );
      }

      if (row.stockQuantity < candidate.quantity) {
        throw new CheckoutError(
          'insufficient_stock',
          row.stockQuantity === 0
            ? `"${String(row.productTitle)}" esgotou.`
            : `Restam apenas ${String(row.stockQuantity)} unidades de "${String(row.productTitle)}".`,
          { variantId: candidate.variantId, available: row.stockQuantity },
        );
      }

      validated.push({
        cartItemId: candidate.cartItemId,
        variantId: candidate.variantId,
        productId: row.productId,
        vendorId: row.vendorId,
        vendorName: String(row.vendorName),
        quantity: candidate.quantity,
        unitPriceCents: cents(Number(row.priceCents)),
        weightGrams: Number(row.weightGrams ?? 0),
        snapshot: {
          title: String(row.productTitle),
          optionsLabel: formatOptions(row.options as Record<string, string>),
          imageUrl: null,
          sku: String(row.sku),
          vendorDisplayName: String(row.vendorName),
        },
      });
    }

    return validated;
  }

  private async loadAddress(tx: Tx, userId: string, addressId: string) {
    const rows = await tx
      .select({
        id: addressTable.id,
        districtId: addressTable.districtId,
        recipientName: addressTable.recipientName,
        phoneE164: addressTable.phoneE164,
        bairro: addressTable.bairro,
        quarteirao: addressTable.quarteirao,
        houseNumber: addressTable.houseNumber,
        landmark: addressTable.landmark,
        notes: addressTable.notes,
        districtName: district.name,
        provinceName: province.name,
      })
      .from(addressTable)
      .innerJoin(district, eq(district.id, addressTable.districtId))
      .innerJoin(province, eq(province.code, addressTable.provinceCode))
      .where(and(eq(addressTable.id, addressId), eq(addressTable.userId, userId)))
      .limit(1);

    const row = rows[0];
    if (row === undefined) {
      throw new CheckoutError('address_not_found', 'A morada de entrega não foi encontrada.');
    }

    const snapshot: AddressSnapshot = {
      recipientName: String(row.recipientName),
      phoneE164: String(row.phoneE164),
      provinceName: String(row.provinceName),
      districtName: String(row.districtName),
      bairro: String(row.bairro),
      quarteirao: row.quarteirao === null ? null : String(row.quarteirao),
      houseNumber: row.houseNumber === null ? null : String(row.houseNumber),
      landmark: String(row.landmark),
      notes: row.notes === null ? null : String(row.notes),
    };

    return { id: String(row.id), districtId: String(row.districtId), snapshot };
  }

  private async markPaymentAwaiting(
    paymentId: string,
    providerTxId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.deps.db
      .update(paymentTable)
      .set({ status: 'awaiting_user', providerTxId, expiresAt })
      .where(eq(paymentTable.id, paymentId));
  }

  private async markPaymentFailed(paymentId: string, code: string, message: string): Promise<void> {
    await this.deps.db
      .update(paymentTable)
      .set({
        status: 'failed',
        failureCode: code,
        failureMessage: message,
        resolvedAt: new Date(),
      })
      .where(eq(paymentTable.id, paymentId));
  }
}

function formatOptions(options: Record<string, string>): string {
  return Object.values(options).join(' · ');
}

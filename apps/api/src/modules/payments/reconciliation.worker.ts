/**
 * Reconciliation workers.
 *
 * These are why correctness never depends on a webhook arriving (D-23). Mobile-money callbacks
 * are late, duplicated, out of order, or absent, and the buyer may close the app, lose signal,
 * or run out of battery at any point. Every one of those is survivable because these jobs ask
 * the provider directly.
 *
 * Four jobs, and the third one is the one that matters most.
 */

import { randomUUID } from 'node:crypto';
import { and, eq, inArray, lt, lte, sql } from 'drizzle-orm';
import { applyPaymentEvent, type PaymentStatus } from '@nhoga/shared';
import {
  orderItem,
  payment as paymentTable,
  paymentEvent as paymentEventTable,
  subOrder as subOrderTable,
} from '../../db/schema/commerce.js';
import { productVariant, stockLedger } from '../../db/schema/catalog.js';
import type { PaymentProvider, ProviderId } from './payment-provider.interface.js';
import type { NormalisedPaymentEvent, PaymentEventProcessor } from './payment-event.processor.js';

export interface ReconciliationDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle db type is schema-generic
  readonly db: any;
  readonly providers: ReadonlyMap<ProviderId, PaymentProvider>;
  readonly processor: PaymentEventProcessor;
  readonly now: () => Date;
  readonly alert: (message: string, context: Record<string, unknown>) => void;
}

export interface SweepSummary {
  readonly examined: number;
  readonly resolved: number;
  readonly stillPending: number;
  readonly errors: number;
}

export class ReconciliationWorker {
  private readonly deps: ReconciliationDeps;

  constructor(deps: ReconciliationDeps) {
    this.deps = deps;
  }

  /**
   * Job 1 — poll pending payments.
   *
   * Scheduled at 30s, 60s, and 180s after initiation, then every 5 minutes for an hour. Asks the
   * provider what actually happened and feeds the answer through the same processor a webhook
   * would use, so there is no second implementation to drift.
   */
  async pollPending(limit = 200): Promise<SweepSummary> {
    const candidates = await this.deps.db
      .select({
        id: paymentTable.id,
        provider: paymentTable.provider,
        providerTxId: paymentTable.providerTxId,
        providerRef: paymentTable.providerRef,
        amountCents: paymentTable.amountCents,
        status: paymentTable.status,
      })
      .from(paymentTable)
      .where(inArray(paymentTable.status, ['initiated', 'awaiting_user']))
      .limit(limit);

    return this.queryAndApply(candidates);
  }

  /**
   * Job 2 — expire what the buyer never answered.
   *
   * `EXPIRED` closes the UI wait. It is explicitly **not** a failure: reconciliation continues,
   * and job 3 can still honour a late approval.
   */
  async expireStale(): Promise<number> {
    const now = this.deps.now();

    const stale = await this.deps.db
      .select({ id: paymentTable.id, status: paymentTable.status })
      .from(paymentTable)
      .where(
        and(
          inArray(paymentTable.status, ['initiated', 'awaiting_user']),
          lt(paymentTable.expiresAt, now),
        ),
      );

    let expired = 0;
    for (const row of stale) {
      const transition = applyPaymentEvent(row.status as PaymentStatus, 'expired');
      if (!transition.changed) continue;

      await this.deps.db
        .update(paymentTable)
        .set({ status: transition.to })
        .where(eq(paymentTable.id, row.id));
      expired += 1;
    }
    return expired;
  }

  /**
   * Job 3 — the late sweep. **The job that protects a debited buyer.**
   *
   * Someone approves on their handset after our three-minute window closed. The money leaves
   * their wallet. Our screen already said "expired". Without this, that person is a debited
   * customer with no order — the worst outcome this system can produce, and the one that
   * generates the story that spreads.
   *
   * Runs hourly against payments in `expired` whose `reconcileUntil` has not passed, for the
   * configured window (default 72 hours). `EXPIRED → PAID` exists in the state machine solely
   * for this.
   */
  async lateSweep(limit = 500): Promise<SweepSummary> {
    const now = this.deps.now();

    const candidates = await this.deps.db
      .select({
        id: paymentTable.id,
        provider: paymentTable.provider,
        providerTxId: paymentTable.providerTxId,
        providerRef: paymentTable.providerRef,
        amountCents: paymentTable.amountCents,
        status: paymentTable.status,
      })
      .from(paymentTable)
      .where(
        and(
          eq(paymentTable.status, 'expired'),
          sql`${paymentTable.reconcileUntil} is not null`,
          lte(sql`${now.toISOString()}::timestamptz`, paymentTable.reconcileUntil),
        ),
      )
      .limit(limit);

    const summary = await this.queryAndApply(candidates);

    if (summary.resolved > 0) {
      // Worth knowing about: it means our approval window is shorter than real-world approval
      // times for some buyers, which is a tuning signal as much as a recovery.
      this.deps.alert('Late payment confirmations recovered', {
        count: summary.resolved,
      });
    }
    return summary;
  }

  /**
   * Job 4 — release stock stranded by payments that never succeeded.
   *
   * Stock is reserved at order creation (checkout.service.ts). When the payment ends in
   * `failed` or a fully-elapsed `expired`, the reservation has to come back to the catalogue,
   * or a popular SKU slowly bleeds availability to abandoned checkouts.
   */
  async releaseStrandedStock(limit = 200): Promise<number> {
    const now = this.deps.now();

    const dead = await this.deps.db
      .select({ id: paymentTable.id, orderId: paymentTable.orderId })
      .from(paymentTable)
      .where(
        and(
          inArray(paymentTable.status, ['failed', 'expired']),
          sql`(${paymentTable.reconcileUntil} is null or ${paymentTable.reconcileUntil} < ${now.toISOString()}::timestamptz)`,
        ),
      )
      .limit(limit);

    let released = 0;

    for (const row of dead) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.deps.db.transaction(async (tx: any) => {
        const items = await tx
          .select({
            variantId: orderItem.variantId,
            quantity: orderItem.quantity,
            subOrderId: orderItem.subOrderId,
            subOrderStatus: subOrderTable.status,
          })
          .from(orderItem)
          .innerJoin(subOrderTable, eq(subOrderTable.id, orderItem.subOrderId))
          .where(eq(subOrderTable.orderId, row.orderId));

        for (const item of items) {
          // Only release for sub-orders that actually died. A sub-order that somehow advanced
          // must keep its reservation.
          if (item.subOrderStatus !== 'cancelled' && item.subOrderStatus !== 'awaiting_payment') {
            continue;
          }

          // Guard against double-release: a ledger row for this order and variant already
          // marked `order_release` means a previous run handled it.
          const existing = await tx
            .select({ id: stockLedger.id })
            .from(stockLedger)
            .where(
              and(
                eq(stockLedger.referenceId, row.orderId),
                eq(stockLedger.variantId, item.variantId),
                eq(stockLedger.reason, 'order_release'),
              ),
            )
            .limit(1);

          if (existing.length > 0) continue;

          await tx
            .update(productVariant)
            .set({ stockQuantity: sql`${productVariant.stockQuantity} + ${item.quantity}` })
            .where(eq(productVariant.id, item.variantId));

          await tx.insert(stockLedger).values({
            id: randomUUID(),
            variantId: item.variantId,
            delta: item.quantity,
            reason: 'order_release',
            referenceId: row.orderId,
            actorId: null,
          });
          released += 1;
        }
      });
    }

    return released;
  }

  // ── shared query-and-apply path ────────────────────────────────────────────

  private async queryAndApply(
    candidates: ReadonlyArray<{
      id: string;
      provider: string;
      providerTxId: string | null;
      providerRef: string;
      amountCents: number;
      status: string;
    }>,
  ): Promise<SweepSummary> {
    let resolved = 0;
    let stillPending = 0;
    let errors = 0;

    for (const candidate of candidates) {
      if (candidate.providerTxId === null) {
        // Accepted by us but never acknowledged by the provider. Nothing to query.
        stillPending += 1;
        continue;
      }

      const provider = this.deps.providers.get(candidate.provider as ProviderId);
      if (provider === undefined) {
        errors += 1;
        this.deps.alert('No provider registered for a pending payment', {
          paymentId: candidate.id,
          provider: candidate.provider,
        });
        continue;
      }

      let status;
      try {
        status = await provider.queryStatus(candidate.providerTxId);
      } catch (error) {
        errors += 1;
        this.deps.alert('Provider status query failed', {
          paymentId: candidate.id,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      if (status.status === 'pending' || status.status === 'unknown') {
        stillPending += 1;
        continue;
      }

      // Persist the query result as a payment_event, exactly as a webhook would be, then run it
      // through the same processor. One path, one set of defences.
      const eventRowId = randomUUID();
      const providerEventId = `RECON-${candidate.providerTxId}-${status.status}`;

      try {
        await this.deps.db
          .insert(paymentEventTable)
          .values({
            id: eventRowId,
            paymentId: candidate.id,
            provider: candidate.provider,
            providerEventId,
            direction: 'inbound',
            eventType: `reconciliation.${status.status}`,
            rawPayload: { source: 'queryStatus', ...status },
            signatureValid: true,
          })
          .onConflictDoNothing();
      } catch (error) {
        errors += 1;
        this.deps.alert('Could not persist a reconciliation event', {
          paymentId: candidate.id,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      const normalised: NormalisedPaymentEvent = {
        paymentEventRowId: eventRowId,
        provider: candidate.provider,
        providerEventId,
        providerTxId: candidate.providerTxId,
        ourReference: candidate.providerRef,
        status: status.status === 'paid' ? 'paid' : status.status === 'cancelled' ? 'cancelled' : 'failed',
        failureCode: status.code,
        amountCents: Number(status.amountCents ?? candidate.amountCents),
        occurredAt: this.deps.now(),
        signatureValid: true,
      };

      const result = await this.deps.processor.process(normalised);

      if (result.outcome === 'applied') resolved += 1;
      else if (result.outcome === 'duplicate') stillPending += 1;
      else {
        errors += 1;
        if (result.alert !== null) {
          this.deps.alert(result.alert, { paymentId: candidate.id });
        }
      }
    }

    return {
      examined: candidates.length,
      resolved,
      stillPending,
      errors,
    };
  }
}

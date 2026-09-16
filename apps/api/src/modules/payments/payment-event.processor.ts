/**
 * Payment event processor.
 *
 * Applies a persisted `payment_event` row to the payment state machine. This is the only code
 * that moves a payment to `paid`, and therefore the only code that lets an order be fulfilled.
 *
 * It runs **asynchronously**, after the webhook receiver has already returned 200. That split is
 * deliberate: providers time out and retry aggressively, so a slow handler causes retry storms.
 * The receiver's whole job is verify-signature, persist, acknowledge.
 *
 * The same processor handles reconciliation results, so a payment confirmed by a status query
 * and a payment confirmed by a webhook take an identical path — there is no second, subtly
 * different implementation to drift.
 */

import { randomUUID } from 'node:crypto';
import { and, eq, isNull, max } from 'drizzle-orm';
import {
  applyPaymentEvent,
  applySubOrderEvent,
  type PaymentEventType,
  type PaymentStatus,
} from '@nhoga/shared';
import {
  payment as paymentTable,
  paymentEvent as paymentEventTable,
  subOrder as subOrderTable,
} from '../../db/schema/commerce.js';
import { outbox } from '../../db/schema/platform.js';

export type ProcessOutcome =
  | 'applied'
  | 'duplicate'
  | 'amount_mismatch'
  | 'unknown_payment'
  | 'illegal_transition'
  | 'bad_signature';

export interface ProcessResult {
  readonly outcome: ProcessOutcome;
  readonly paymentId: string | null;
  readonly from: PaymentStatus | null;
  readonly to: PaymentStatus | null;
  /** Set when the outcome warrants an operator alert rather than a debug log. */
  readonly alert: string | null;
}

export interface ProcessorDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle db type is schema-generic
  readonly db: any;
  readonly now: () => Date;
}

/** A normalised inbound event, already parsed and signature-checked by the provider adapter. */
export interface NormalisedPaymentEvent {
  readonly paymentEventRowId: string;
  readonly provider: string;
  readonly providerEventId: string;
  readonly providerTxId: string;
  readonly ourReference: string;
  readonly status: 'paid' | 'failed' | 'cancelled';
  readonly failureCode: string | null;
  readonly amountCents: number;
  readonly occurredAt: Date;
  readonly signatureValid: boolean;
}

export class PaymentEventProcessor {
  private readonly deps: ProcessorDeps;

  constructor(deps: ProcessorDeps) {
    this.deps = deps;
  }

  /**
   * Process one event.
   *
   * Everything happens in a single transaction: the payment transition, the sub-order
   * transitions it implies, the outbox write, and marking the event processed. A crash halfway
   * through leaves the event unprocessed and the worker picks it up again — which is safe
   * because the state machine treats a re-application as `already_applied`.
   */
  async process(event: NormalisedPaymentEvent): Promise<ProcessResult> {
    if (!event.signatureValid) {
      // Should already have been refused at the edge. Reaching here means a bug or a
      // misconfiguration, and either way it must never touch payment state.
      await this.markProcessed(event.paymentEventRowId, 'bad_signature');
      return {
        outcome: 'bad_signature',
        paymentId: null,
        from: null,
        to: null,
        alert: 'A payment callback with an invalid signature reached the processor.',
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.deps.db.transaction(async (tx: any): Promise<ProcessResult> => {
      const rows = await tx
        .select({
          id: paymentTable.id,
          orderId: paymentTable.orderId,
          status: paymentTable.status,
          amountCents: paymentTable.amountCents,
          providerRef: paymentTable.providerRef,
        })
        .from(paymentTable)
        .where(
          and(
            eq(paymentTable.provider, event.provider),
            eq(paymentTable.providerTxId, event.providerTxId),
          ),
        )
        .limit(1)
        .for('update');

      const payment = rows[0];

      if (payment === undefined) {
        // An orphan: the provider knows about a transaction we do not. Surfaces to the daily
        // operations queue rather than being dropped — it may be a buyer whose money moved.
        await this.markProcessed(event.paymentEventRowId, 'unknown_payment');
        return {
          outcome: 'unknown_payment',
          paymentId: null,
          from: null,
          to: null,
          alert: `Callback for unknown transaction ${event.providerTxId} (${event.provider}).`,
        };
      }

      // Defence: we do not trust an external payload to tell us what we charged.
      if (Number(payment.amountCents) !== event.amountCents) {
        await this.markProcessed(event.paymentEventRowId, 'amount_mismatch');
        return {
          outcome: 'amount_mismatch',
          paymentId: String(payment.id),
          from: payment.status as PaymentStatus,
          to: null,
          alert:
            `Amount mismatch on ${event.providerTxId}: provider reported ${event.amountCents}, ` +
            `our record is ${String(payment.amountCents)}.`,
        };
      }

      const eventType: PaymentEventType =
        event.status === 'paid' ? 'confirmed_paid' : 'confirmed_failed';

      const transition = applyPaymentEvent(payment.status as PaymentStatus, eventType);

      if (!transition.changed) {
        await this.markProcessed(event.paymentEventRowId, transition.reason);

        // A duplicate is routine — the provider retrying. An illegal transition means they told
        // us something inconsistent with our record, which is worth waking someone for.
        const isDuplicate = transition.reason === 'already_applied';
        return {
          outcome: isDuplicate ? 'duplicate' : 'illegal_transition',
          paymentId: String(payment.id),
          from: transition.from,
          to: null,
          alert: isDuplicate
            ? null
            : `Illegal payment transition: ${transition.from} cannot accept ${eventType} ` +
              `(payment ${String(payment.id)}).`,
        };
      }

      const now = this.deps.now();

      await tx
        .update(paymentTable)
        .set({
          status: transition.to,
          resolvedAt: now,
          failureCode: event.failureCode,
          failureMessage: null,
        })
        .where(eq(paymentTable.id, payment.id));

      if (transition.to === 'paid') {
        await this.advanceSubOrders(tx, String(payment.orderId), 'payment_settled', now);
      } else if (transition.to === 'failed') {
        await this.advanceSubOrders(tx, String(payment.orderId), 'payment_failed', now);
      }

      await tx.insert(outbox).values({
        id: randomUUID(),
        aggregateType: 'payment',
        aggregateId: payment.id,
        eventType: transition.to === 'paid' ? 'payment.paid' : 'payment.failed',
        sequence: await this.nextSequence(tx, 'payment', String(payment.id)),
        payload: {
          paymentId: payment.id,
          orderId: payment.orderId,
          status: transition.to,
          failureCode: event.failureCode,
          amountCents: event.amountCents,
        },
      });

      await this.markProcessed(event.paymentEventRowId, null, tx);

      return {
        outcome: 'applied',
        paymentId: String(payment.id),
        from: transition.from,
        to: transition.to,
        alert: null,
      };
    });
  }

  /**
   * Move every sub-order on the order.
   *
   * Transitions are applied per sub-order through the shared state machine rather than with a
   * blanket UPDATE, so a sub-order already cancelled by an admin is left alone instead of being
   * dragged back into an impossible state.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async advanceSubOrders(
    tx: any,
    orderId: string,
    eventType: 'payment_settled' | 'payment_failed',
    now: Date,
  ): Promise<void> {
    const subOrders = await tx
      .select({ id: subOrderTable.id, status: subOrderTable.status })
      .from(subOrderTable)
      .where(eq(subOrderTable.orderId, orderId));

    for (const row of subOrders) {
      const result = applySubOrderEvent(
        row.status as Parameters<typeof applySubOrderEvent>[0],
        eventType,
        'system',
      );
      if (!result.changed) continue;

      const patch: Record<string, unknown> = { status: result.to };
      if (result.to === 'confirmed') {
        // 24h for the vendor to accept. Silence auto-cancels — an unanswered order is worse for
        // buyer trust than a declined one.
        patch['respondByAt'] = new Date(now.getTime() + 24 * 3600 * 1000);
      }

      await tx.update(subOrderTable).set(patch).where(eq(subOrderTable.id, row.id));

      await tx.insert(outbox).values({
        id: randomUUID(),
        aggregateType: 'sub_order',
        aggregateId: row.id,
        eventType: `sub_order.${result.to}`,
        sequence: await this.nextSequence(tx, 'sub_order', String(row.id)),
        payload: { subOrderId: row.id, from: result.from, to: result.to, cause: eventType },
      });
    }
  }

  private async markProcessed(
    rowId: string,
    error: string | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx?: any,
  ): Promise<void> {
    const executor = tx ?? this.deps.db;
    await executor
      .update(paymentEventTable)
      .set({ processedAt: this.deps.now(), processingError: error })
      .where(
        and(eq(paymentEventTable.id, rowId), isNull(paymentEventTable.processedAt)),
      );
  }

  /**
   * Next sequence number for an aggregate's outbox stream.
   *
   * Runs inside the caller's transaction, against `outbox_aggregate_sequence_key`. Two
   * concurrent writers for the same aggregate would compute the same number and one would
   * violate that unique constraint — which is the correct outcome: the loser retries and gets
   * the next value, rather than two events silently claiming the same position in the stream.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async nextSequence(tx: any, aggregateType: string, aggregateId: string): Promise<number> {
    const rows = await tx
      .select({ highest: max(outbox.sequence) })
      .from(outbox)
      .where(and(eq(outbox.aggregateType, aggregateType), eq(outbox.aggregateId, aggregateId)));

    const highest = rows[0]?.highest;
    return (highest === null || highest === undefined ? 0 : Number(highest)) + 1;
  }
}

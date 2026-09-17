import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB } from '../../../../db/database.module.js';
import { paymentEvent } from '../../../../db/schema/commerce.js';
import type { Db } from '../../../../db/types.js';
import { PaymentEventProcessor } from '../../payment-event.processor.js';
import type { ProviderId, RawCallback } from '../../payment-provider.interface.js';
import { PaymentProvidersService } from '../../providers.service.js';

const PROVIDER_IDS: readonly ProviderId[] = ['mpesa', 'emola', 'mkesh', 'cod'];

export type IngestOutcome =
  | 'unknown_provider' // path names a rail we do not run          -> 404
  | 'bad_signature' //   signature did not verify                  -> 400
  | 'malformed' //       signature ok, body unusable               -> 400
  | 'duplicate' //       already received; idempotent no-op        -> 200
  | 'accepted'; //       durably recorded and handed to processor  -> 200

export interface IngestResult {
  readonly outcome: IngestOutcome;
  /** The processor's outcome, when the event reached it. Informational. */
  readonly processing?: string;
}

/**
 * Payment webhook ingestion.
 *
 * The ordering is deliberate and is the whole correctness story:
 *
 *   1. Parse and verify the signature against the exact received bytes. A bad
 *      signature never reaches payment state.
 *   2. Persist the event before processing it, keyed by (provider,
 *      providerEventId). The UNIQUE index makes a provider's duplicate delivery
 *      a database no-op, so idempotency is enforced by the schema, not by code
 *      that must remember to check.
 *   3. Only a freshly-inserted event is handed to the processor, which applies
 *      the payment transition transactionally.
 *
 * The endpoint acknowledges (200) as soon as the event is durably recorded,
 * even when processing finds a problem (amount mismatch, illegal transition):
 * the provider retrying would not help, and the problem is recorded and
 * alerted internally. Only a failure to record (database down) returns non-2xx,
 * so the provider retries.
 *
 * This logic is deploy-agnostic. It is hosted in the API app today; its home is
 * the separate `apps/webhooks` deploy (00-stack-rationale §7), a move rather
 * than a rewrite.
 */
@Injectable()
export class WebhookIngestionService {
  private readonly logger = new Logger('WebhookIngestion');

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly providers: PaymentProvidersService,
    private readonly processor: PaymentEventProcessor,
  ) {}

  async ingest(providerParam: string, raw: RawCallback): Promise<IngestResult> {
    if (!isProviderId(providerParam)) {
      return { outcome: 'unknown_provider' };
    }
    const provider = this.providers.get(providerParam);
    if (provider === undefined) {
      return { outcome: 'unknown_provider' };
    }

    const parsed = provider.parseCallback(raw);

    if (!parsed.valid) {
      // Record the rejected callback for audit. A malformed body means the
      // signature verified but the payload did not; a bad signature is the
      // reverse. providerEventId is null, so these never collide.
      if (parsed.reason !== 'unknown_provider') {
        await this.recordRejected(providerParam, raw, parsed.reason);
      }
      return { outcome: parsed.reason === 'bad_signature' ? 'bad_signature' : 'malformed' };
    }

    // Insert keyed on the partial unique index. onConflictDoNothing returns no
    // row when the event was seen before -> a duplicate delivery.
    const inserted = await this.db
      .insert(paymentEvent)
      .values({
        id: crypto.randomUUID(),
        provider: providerParam,
        providerEventId: parsed.providerEventId,
        direction: 'inbound',
        eventType: 'callback',
        rawPayload: safeJson(raw.rawBody),
        signatureValid: true,
      })
      .onConflictDoNothing({
        target: [paymentEvent.provider, paymentEvent.providerEventId],
        where: sql`${paymentEvent.providerEventId} is not null`,
      })
      .returning({ id: paymentEvent.id });

    const rowId = inserted[0]?.id;
    if (rowId === undefined) {
      return { outcome: 'duplicate' };
    }

    const result = await this.processor.process({
      paymentEventRowId: rowId,
      provider: providerParam,
      providerEventId: parsed.providerEventId,
      providerTxId: parsed.providerTxId,
      ourReference: parsed.ourReference,
      status: parsed.status,
      failureCode: parsed.code,
      amountCents: parsed.amountCents,
      occurredAt: parsed.occurredAt,
      signatureValid: true,
    });

    if (result.alert) {
      this.logger.error(`Payment webhook alert: ${result.alert}`);
    }

    return { outcome: 'accepted', processing: result.outcome };
  }

  private async recordRejected(
    provider: string,
    raw: RawCallback,
    reason: 'bad_signature' | 'malformed',
  ): Promise<void> {
    try {
      await this.db.insert(paymentEvent).values({
        id: crypto.randomUUID(),
        provider,
        providerEventId: null,
        direction: 'inbound',
        eventType: 'callback',
        rawPayload: safeJson(raw.rawBody),
        signatureValid: reason === 'bad_signature' ? false : true,
        processingError: reason,
      });
    } catch (err) {
      // Audit persistence must not turn a rejected callback into a 500 that
      // makes the provider retry a payload we already refused.
      this.logger.warn(`Could not record rejected callback: ${String(err)}`);
    }
  }
}

function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

/** Store the body as JSON when it is JSON, otherwise wrap the raw text. The raw
 *  bytes are what matter for audit either way. */
function safeJson(rawBody: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { raw: parsed };
  } catch {
    return { raw: rawBody };
  }
}

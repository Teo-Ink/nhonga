import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cents } from '@nhonga/shared';
import type {
  CallbackParseResult,
  PaymentProvider,
  RawCallback,
} from '../../payment-provider.interface.js';
import { WebhookIngestionService } from './webhook-ingestion.service.js';

// ── Fakes ────────────────────────────────────────────────────────────────────

interface Inserted {
  values: Record<string, unknown>;
  conflictHandled: boolean;
}

/** Minimal drizzle-shaped insert fake capturing values and driving the
 *  onConflictDoNothing().returning() result. */
function makeDb(returning: Array<{ id: string }>) {
  const inserts: Inserted[] = [];
  const db = {
    insert() {
      return {
        values(v: Record<string, unknown>) {
          const record: Inserted = { values: v, conflictHandled: false };
          inserts.push(record);
          const builder = {
            onConflictDoNothing() {
              record.conflictHandled = true;
              return { returning: async () => returning };
            },
            // Awaited directly by recordRejected.
            then(resolve: (v: unknown) => void) {
              resolve(undefined);
            },
          };
          return builder;
        },
      };
    },
  };
  return { db: db as never, inserts };
}

function makeProvider(result: CallbackParseResult): PaymentProvider {
  return { parseCallback: () => result } as unknown as PaymentProvider;
}

const RAW: RawCallback = { headers: {}, rawBody: '{"eventId":"e1"}' };

const VALID: CallbackParseResult = {
  valid: true,
  providerEventId: 'evt-1',
  providerTxId: 'tx-1',
  ourReference: 'PAY-1',
  status: 'paid',
  code: null,
  amountCents: cents(15000),
  occurredAt: new Date('2026-09-17T10:00:00.000Z'),
};

function makeService(opts: {
  provider?: PaymentProvider | undefined;
  returning?: Array<{ id: string }>;
  processResult?: { outcome: string; alert: string | null };
}) {
  const { db, inserts } = makeDb(opts.returning ?? [{ id: 'row-1' }]);
  const providers = { get: () => opts.provider } as never;
  const process = vi.fn(async () => ({
    outcome: opts.processResult?.outcome ?? 'applied',
    paymentId: 'p1',
    from: null,
    to: null,
    alert: opts.processResult?.alert ?? null,
  }));
  const processor = { process } as never;
  const service = new WebhookIngestionService(db, providers, processor);
  return { service, inserts, process };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('WebhookIngestionService', () => {
  let provider: PaymentProvider;
  beforeEach(() => {
    provider = makeProvider(VALID);
  });

  it('404s a provider path we do not run, without touching the database', async () => {
    const { service, inserts } = makeService({ provider });
    const res = await service.ingest('paypal', RAW);
    expect(res.outcome).toBe('unknown_provider');
    expect(inserts).toHaveLength(0);
  });

  it('rejects a bad signature and records it as signatureValid=false, never processing it', async () => {
    const { service, inserts, process } = makeService({
      provider: makeProvider({ valid: false, reason: 'bad_signature' }),
    });
    const res = await service.ingest('mpesa', RAW);
    expect(res.outcome).toBe('bad_signature');
    expect(process).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.values['signatureValid']).toBe(false);
    expect(inserts[0]?.values['providerEventId']).toBeNull();
  });

  it('rejects a malformed body (signature ok) and does not process it', async () => {
    const { service, inserts, process } = makeService({
      provider: makeProvider({ valid: false, reason: 'malformed' }),
    });
    const res = await service.ingest('mpesa', RAW);
    expect(res.outcome).toBe('malformed');
    expect(process).not.toHaveBeenCalled();
    expect(inserts[0]?.values['signatureValid']).toBe(true);
  });

  it('persists then processes a valid event, passing the row id and parsed fields', async () => {
    const { service, inserts, process } = makeService({ provider });
    const res = await service.ingest('mpesa', RAW);
    expect(res.outcome).toBe('accepted');
    expect(res.processing).toBe('applied');
    // recorded before processing, keyed on the provider event id, sig valid
    expect(inserts[0]?.values['providerEventId']).toBe('evt-1');
    expect(inserts[0]?.conflictHandled).toBe(true);
    // processor received the freshly-inserted row id and the parsed amount
    expect(process).toHaveBeenCalledTimes(1);
    const event = process.mock.calls[0]![0] as Record<string, unknown>;
    expect(event['paymentEventRowId']).toBe('row-1');
    expect(event['providerTxId']).toBe('tx-1');
    expect(event['amountCents']).toBe(15000);
    expect(event['signatureValid']).toBe(true);
  });

  it('treats a duplicate delivery (no row inserted) as an idempotent no-op, not reprocessing', async () => {
    const { service, process } = makeService({ provider, returning: [] });
    const res = await service.ingest('mpesa', RAW);
    expect(res.outcome).toBe('duplicate');
    expect(process).not.toHaveBeenCalled();
  });

  it('still acknowledges when the processor reports a problem (amount mismatch)', async () => {
    const { service } = makeService({
      provider,
      processResult: { outcome: 'amount_mismatch', alert: 'mismatch!' },
    });
    const res = await service.ingest('mpesa', RAW);
    // Recorded and handed off; the provider must not be told to retry.
    expect(res.outcome).toBe('accepted');
    expect(res.processing).toBe('amount_mismatch');
  });
});

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { PaymentProvidersService } from './providers.service.js';
import { WebhookIngestionService } from './http/webhooks/webhook-ingestion.service.js';

/**
 * Closes the mock payment loop in-process.
 *
 * The mock wallet provider "delivers" its asynchronous callback by handing a
 * signed body back to us — in production this is the provider's HTTP POST to our
 * webhook. Here we route it straight into the same WebhookIngestionService the
 * real webhook controller uses, so the settlement path is identical whether the
 * callback arrives over HTTP or from the mock. Wiring it here (rather than inside
 * PaymentProvidersService) keeps that service free of a dependency on the
 * ingestion service and so avoids a construction-time DI cycle.
 */
@Injectable()
export class MockCallbackWiring implements OnModuleInit {
  private readonly log = new Logger('MockCallbackWiring');

  constructor(
    private readonly providers: PaymentProvidersService,
    private readonly ingestion: WebhookIngestionService,
  ) {}

  onModuleInit(): void {
    this.providers.setCallbackDelivery((payload) => {
      void this.ingestion
        .ingest(payload.providerId, { headers: payload.headers, rawBody: payload.rawBody })
        .catch((err: unknown) => {
          this.log.error(`mock callback delivery failed for ${payload.providerId}`, err);
        });
    });
  }
}

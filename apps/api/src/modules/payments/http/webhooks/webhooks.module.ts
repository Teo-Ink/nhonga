import { Module, type Provider } from '@nestjs/common';
import { PaymentEventProcessor } from '../../payment-event.processor.js';
import { PaymentProvidersService } from '../../providers.service.js';
import { MockCallbackWiring } from '../../mock-callback.wiring.js';
import { DB } from '../../../../db/database.module.js';
import type { Db } from '../../../../db/types.js';
import { WebhookIngestionService } from './webhook-ingestion.service.js';
import { WebhooksController } from './webhooks.controller.js';

// The processor is a plain domain class taking { db, now }; provide it via a
// factory rather than decorating the domain layer with framework annotations.
const processorProvider: Provider = {
  provide: PaymentEventProcessor,
  inject: [DB],
  useFactory: (db: Db): PaymentEventProcessor =>
    new PaymentEventProcessor({ db, now: () => new Date() }),
};

// PaymentProvidersService and WebhookIngestionService are exported so the
// checkout module reuses the SAME instances: the mock wallet provider keeps its
// initiated transactions in memory, so the object that requests a payment must be
// the one that later parses the callback.
@Module({
  controllers: [WebhooksController],
  providers: [
    PaymentProvidersService,
    processorProvider,
    WebhookIngestionService,
    MockCallbackWiring,
  ],
  exports: [PaymentProvidersService, WebhookIngestionService],
})
export class WebhooksModule {}

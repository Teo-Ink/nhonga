import { Module, type Provider } from '@nestjs/common';
import { PaymentEventProcessor } from '../../payment-event.processor.js';
import { PaymentProvidersService } from '../../providers.service.js';
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

@Module({
  controllers: [WebhooksController],
  providers: [PaymentProvidersService, processorProvider, WebhookIngestionService],
})
export class WebhooksModule {}

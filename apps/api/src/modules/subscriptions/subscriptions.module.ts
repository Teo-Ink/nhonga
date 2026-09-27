import { Module } from '@nestjs/common';
import { WebhooksModule } from '../payments/http/webhooks/webhooks.module.js';
import { SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';

// Reuses PaymentProvidersService (exported by WebhooksModule) to validate the
// payment method against the real provider registry.
@Module({
  imports: [WebhooksModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}

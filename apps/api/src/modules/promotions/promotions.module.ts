import { Module } from '@nestjs/common';
import { WebhooksModule } from '../payments/http/webhooks/webhooks.module.js';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsService } from './promotions.service.js';

// Reuses PaymentProvidersService (exported by WebhooksModule) to validate the
// payment method against the real provider registry.
@Module({
  imports: [WebhooksModule],
  controllers: [PromotionsController],
  providers: [PromotionsService],
})
export class PromotionsModule {}

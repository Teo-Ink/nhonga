import { AuthModule } from '../auth/auth.module.js';
import { Module } from '@nestjs/common';
import { WebhooksModule } from '../payments/http/webhooks/webhooks.module.js';
import { AdsController } from './ads.controller.js';
import { AdsService } from './ads.service.js';

// Display-ad campaigns (house-ads monetisation). WebhooksModule provides the
// shared PaymentProvidersService used to validate the payment method.
@Module({
  imports: [WebhooksModule, AuthModule],
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}

import { Module } from '@nestjs/common';
import { PaymentProvidersModule } from '../payments/payment-providers.module.js';
import { SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';

// Reuses PaymentProvidersService (exported by PaymentProvidersModule) to validate the
// payment method against the real provider registry.
@Module({
  imports: [PaymentProvidersModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}

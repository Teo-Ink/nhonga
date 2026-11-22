import { Module } from '@nestjs/common';
import { PaymentProvidersModule } from '../payments/payment-providers.module.js';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsService } from './promotions.service.js';

// Reuses PaymentProvidersService (exported by PaymentProvidersModule) to validate the
// payment method against the real provider registry.
@Module({
  imports: [PaymentProvidersModule],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}

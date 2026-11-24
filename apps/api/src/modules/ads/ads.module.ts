import { AuthModule } from '../auth/auth.module.js';
import { Module } from '@nestjs/common';
import { PaymentProvidersModule } from '../payments/payment-providers.module.js';
import { AdsController } from './ads.controller.js';
import { AdsService } from './ads.service.js';

// Display-ad campaigns (house-ads monetisation). PaymentProvidersModule provides the
// shared PaymentProvidersService used to validate the payment method.
@Module({
  imports: [PaymentProvidersModule, AuthModule],
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}

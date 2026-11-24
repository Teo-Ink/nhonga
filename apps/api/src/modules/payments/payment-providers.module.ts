import { Module } from '@nestjs/common';
import { PaymentProvidersService } from './providers.service.js';

/**
 * The list of payment methods offered (M-Pesa, e-Mola, …), used to validate a
 * chosen method. Money itself moves through the checkout module (hosted
 * checkout + wallet). The marketplace order flow that used to live here
 * (orders, per-order payments, its webhooks) was never used by the
 * classifieds and was removed (ARQ-06 / PAG-006); its tables stay, read-only,
 * for the records.
 */
@Module({
  providers: [PaymentProvidersService],
  exports: [PaymentProvidersService],
})
export class PaymentProvidersModule {}

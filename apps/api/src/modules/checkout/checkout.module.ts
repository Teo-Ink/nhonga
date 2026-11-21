import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module.js';
import { CheckoutController } from './checkout.controller.js';
import { CHECKOUT_SETUP, CheckoutService, checkoutSetupFromEnv } from './checkout.service.js';

// Hosted mobile-money checkout: PawaPay (primary, M-Pesa) with PaySuite as
// backup and as the route for e-Mola / mKesh / card. See checkout.config.ts
// for the environment variables.
@Module({
  imports: [WalletModule],
  controllers: [CheckoutController],
  providers: [{ provide: CHECKOUT_SETUP, useFactory: checkoutSetupFromEnv }, CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}

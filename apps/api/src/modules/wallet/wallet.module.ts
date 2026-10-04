import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { WalletController } from './wallet.controller.js';
import { WalletService } from './wallet.service.js';

// Seller wallet: balance + loyalty points, demo top-ups and prepaid packages,
// and spending balance to promote a listing (via PromotionsService).
@Module({
  imports: [AuthModule, PromotionsModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}

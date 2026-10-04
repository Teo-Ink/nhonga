import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { WalletController } from './wallet.controller.js';
import { WalletService } from './wallet.service.js';

// Seller wallet: balance + loyalty points, demo top-ups and prepaid packages.
@Module({
  imports: [AuthModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}

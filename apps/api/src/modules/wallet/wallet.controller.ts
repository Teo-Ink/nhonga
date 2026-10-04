import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import {
  WalletService,
  type WalletPackage,
  type WalletView,
} from './wallet.service.js';

function bearer(authz: string | undefined): string | null {
  return authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
}

// Seller wallet: balance (MZN) + loyalty points, with demo top-ups and prepaid
// packages. All reads/writes are scoped to the caller's own shop.
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  get(@Headers('authorization') authz?: string): Promise<WalletView> {
    return this.wallet.get(bearer(authz));
  }

  @Get('packages')
  packages(): readonly WalletPackage[] {
    return this.wallet.packages();
  }

  @Post('topup')
  @HttpCode(200)
  topup(
    @Body() body: { amountCents?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<WalletView> {
    const amount = typeof body.amountCents === 'number' ? body.amountCents : Number(body.amountCents);
    return this.wallet.topup(bearer(authz), amount);
  }

  @Post('purchase')
  @HttpCode(200)
  purchase(
    @Body() body: { packageId?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<WalletView> {
    const id = typeof body.packageId === 'string' ? body.packageId : '';
    return this.wallet.purchase(bearer(authz), id);
  }
}

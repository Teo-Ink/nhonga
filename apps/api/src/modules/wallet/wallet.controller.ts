import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import {
  WalletService,
  type BoostPlanDto,
  type BoostResult,
  type WalletPackage,
  type WalletView,
} from './wallet.service.js';
import { WalletBoost, WalletPurchase, WalletTopup } from '@nhonga/shared';
import { ZodBody } from '../../common/zod-body.js';

function bearer(authz: string | undefined): string | null {
  return authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
}

// Seller wallet: balance (MZN) + loyalty points, with demo top-ups and prepaid
// packages. All reads/writes are scoped to the caller's own shop.
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  /** Promotion plans a seller can buy (Destaque/Turbo with balance, Subir with points). */
  @Get('plans')
  plans(@Headers('accept-language') lang?: string): Promise<BoostPlanDto[]> {
    return this.wallet.boostPlans(lang?.toLowerCase().startsWith('en') ? 'en' : 'pt');
  }

  @Post('pro')
  @HttpCode(200)
  subscribePro(@Headers('authorization') authz?: string): Promise<WalletView> {
    return this.wallet.subscribePro(bearer(authz));
  }

  @Post('boost')
  @HttpCode(200)
  boost(
    @Body(new ZodBody(WalletBoost)) body: { productId?: unknown; planCode?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<BoostResult> {
    const productId = typeof body.productId === 'string' ? body.productId : '';
    const planCode = typeof body.planCode === 'string' ? body.planCode : '';
    return this.wallet.boost(bearer(authz), productId, planCode);
  }

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
    @Body(new ZodBody(WalletTopup)) body: { amountCents?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<WalletView> {
    const amount =
      typeof body.amountCents === 'number' ? body.amountCents : Number(body.amountCents);
    return this.wallet.topup(bearer(authz), amount);
  }

  @Post('purchase')
  @HttpCode(200)
  purchase(
    @Body(new ZodBody(WalletPurchase)) body: { packageId?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<WalletView> {
    const id = typeof body.packageId === 'string' ? body.packageId : '';
    return this.wallet.purchase(bearer(authz), id);
  }
}

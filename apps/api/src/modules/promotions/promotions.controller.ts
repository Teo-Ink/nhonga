import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  PromotionError,
  PromotionsService,
  type PlanDto,
  type ReceiptDto,
} from './promotions.service.js';
import { ADMIN_HEADER, assertAdmin } from '../../common/admin.js';
import { PromotionPurchase } from '@nhonga/shared';
import { ZodBody } from '../../common/zod-body.js';

interface PurchaseBody {
  productSlug?: unknown;
  planCode?: unknown;
  paymentMethod?: unknown;
  payPhone?: unknown;
}

/** Paid visibility (E). Buying a promotion boosts a listing in search. */
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get('plans')
  plans(@Headers('accept-language') lang?: string): Promise<PlanDto[]> {
    return this.promotions.listPlans(lang?.toLowerCase().startsWith('en') ? 'en' : 'pt');
  }

  /** Ops/admin-lite: active promotions (E4). */
  @Get('admin/active')
  active(@Headers(ADMIN_HEADER) adminToken?: string): Promise<ReceiptDto[]> {
    assertAdmin(adminToken);
    return this.promotions.listActive();
  }

  @Post()
  @HttpCode(201)
  async buy(
    @Body(new ZodBody(PromotionPurchase)) body: PurchaseBody,
  ): Promise<{ id: string; status: string; receipt: ReceiptDto }> {
    const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
    const productSlug = str(body.productSlug);
    const planCode = str(body.planCode);
    const paymentMethod = str(body.paymentMethod);
    if (!productSlug || !planCode || !paymentMethod) {
      throw new BadRequestException({
        message: 'productSlug, planCode and paymentMethod required',
      });
    }
    try {
      return await this.promotions.purchase({
        productSlug,
        planCode,
        paymentMethod,
        ...(str(body.payPhone) ? { payPhone: str(body.payPhone) } : {}),
      });
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Get(':id')
  async receipt(@Param('id') id: string): Promise<ReceiptDto> {
    try {
      return await this.promotions.receipt(id);
    } catch (e) {
      throw toHttp(e);
    }
  }
}

function toHttp(e: unknown): HttpException {
  if (e instanceof PromotionError) {
    if (e.code === 'not_found') return new NotFoundException({ message: e.message });
    if (e.code === 'unavailable')
      return new HttpException({ message: e.message }, HttpStatus.SERVICE_UNAVAILABLE);
    return new BadRequestException({ message: e.message });
  }
  return new HttpException({ message: 'internal error' }, HttpStatus.INTERNAL_SERVER_ERROR);
}

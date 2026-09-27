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
  SubscriptionError,
  SubscriptionsService,
  type SubPlanDto,
  type SubReceiptDto,
} from './subscriptions.service.js';

interface SubscribeBody {
  vendorSlug?: unknown;
  planCode?: unknown;
  paymentMethod?: unknown;
}

/** Paid "Loja Pro" subscription — a verified, premium shop. */
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('plans')
  plans(@Headers('accept-language') lang?: string): SubPlanDto[] {
    return this.subscriptions.listPlans(lang?.toLowerCase().startsWith('en') ? 'en' : 'pt');
  }

  @Post()
  @HttpCode(201)
  async subscribe(
    @Body() body: SubscribeBody,
  ): Promise<{ id: string; status: string; receipt: SubReceiptDto }> {
    const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
    const vendorSlug = str(body.vendorSlug);
    const planCode = str(body.planCode);
    const paymentMethod = str(body.paymentMethod);
    if (!vendorSlug || !planCode || !paymentMethod) {
      throw new BadRequestException({
        message: 'vendorSlug, planCode and paymentMethod required',
      });
    }
    try {
      return await this.subscriptions.subscribe({ vendorSlug, planCode, paymentMethod });
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Get(':id')
  async receipt(@Param('id') id: string): Promise<SubReceiptDto> {
    try {
      return await this.subscriptions.receipt(id);
    } catch (e) {
      throw toHttp(e);
    }
  }
}

function toHttp(e: unknown): HttpException {
  if (e instanceof SubscriptionError) {
    if (e.code === 'not_found') return new NotFoundException({ message: e.message });
    if (e.code === 'unavailable')
      return new HttpException({ message: e.message }, HttpStatus.SERVICE_UNAVAILABLE);
    return new BadRequestException({ message: e.message });
  }
  return new HttpException({ message: 'internal error' }, HttpStatus.INTERNAL_SERVER_ERROR);
}

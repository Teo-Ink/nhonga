import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CheckoutError } from './checkout.service.js';
import { GuestCheckoutService, type GuestCheckoutInput } from './guest-checkout.service.js';
import { OrderQueryService, type OrderView } from './order-query.service.js';
import { newIdempotencyKey } from './checkout-deps.js';
import type { ProviderId } from '../payments/payment-provider.interface.js';

const PROVIDERS: readonly ProviderId[] = ['mpesa', 'emola', 'mkesh', 'cod'];

interface CheckoutBody {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  deliveryMethod?: unknown;
  province?: unknown;
  district?: unknown;
  bairro?: unknown;
  landmark?: unknown;
  house?: unknown;
  paymentMethod?: unknown;
  payPhone?: unknown;
  items?: unknown;
  expectedTotalCents?: unknown;
  idempotencyKey?: unknown;
}

/** Guest checkout. Public: a guest does not authenticate to buy. */
@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly guest: GuestCheckoutService,
    private readonly orders: OrderQueryService,
  ) {}

  @Post()
  @HttpCode(201)
  async place(@Body() body: CheckoutBody): Promise<{
    orderNumber: string;
    orderId: string;
    paymentStatus: string;
    failure: { code: string; message: string; retryable: boolean } | null;
  }> {
    const input = this.parse(body);
    try {
      const result = await this.guest.placeOrder(input);
      return result;
    } catch (e) {
      if (e instanceof CheckoutError) throw this.toHttp(e);
      throw e;
    }
  }

  @Get('orders/:orderNumber')
  async order(@Param('orderNumber') orderNumber: string): Promise<OrderView> {
    return this.orders.byNumber(orderNumber);
  }

  private parse(body: CheckoutBody): GuestCheckoutInput {
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    const name = str(body.name).trim();
    const phone = str(body.phone).trim();
    const deliveryMethod = body.deliveryMethod === 'pickup' ? 'pickup' : 'home';
    const paymentMethod = body.paymentMethod;
    const total = body.expectedTotalCents;

    if (name === '') throw new BadRequestException({ message: 'name is required' });
    if (phone === '') throw new BadRequestException({ message: 'phone is required' });
    if (typeof paymentMethod !== 'string' || !PROVIDERS.includes(paymentMethod as ProviderId)) {
      throw new BadRequestException({ message: 'paymentMethod is invalid' });
    }
    if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) {
      throw new BadRequestException({ message: 'expectedTotalCents is invalid' });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new BadRequestException({ message: 'items is required' });
    }

    const cartLines = body.items.map((raw): { variantId: string; quantity: number } => {
      const it = raw as { variantId?: unknown; quantity?: unknown };
      const variantId = typeof it.variantId === 'string' ? it.variantId : '';
      const quantity = typeof it.quantity === 'number' ? Math.floor(it.quantity) : 0;
      if (variantId === '' || quantity <= 0) {
        throw new BadRequestException({ message: 'each item needs a variantId and quantity' });
      }
      return { variantId, quantity };
    });

    return {
      name,
      phone,
      ...(str(body.email).trim() ? { email: str(body.email).trim() } : {}),
      deliveryMethod,
      ...(str(body.province).trim() ? { province: str(body.province).trim() } : {}),
      ...(str(body.district).trim() ? { district: str(body.district).trim() } : {}),
      ...(str(body.bairro).trim() ? { bairro: str(body.bairro).trim() } : {}),
      ...(str(body.landmark).trim() ? { landmark: str(body.landmark).trim() } : {}),
      ...(str(body.house).trim() ? { house: str(body.house).trim() } : {}),
      paymentMethod: paymentMethod as ProviderId,
      ...(str(body.payPhone).trim() ? { payPhone: str(body.payPhone).trim() } : {}),
      cartLines,
      expectedTotalCents: total,
      idempotencyKey: str(body.idempotencyKey).trim() || newIdempotencyKey(),
    };
  }

  private toHttp(e: CheckoutError): Error {
    const payload = { error: 'Checkout', message: e.userMessage, code: e.code };
    switch (e.code) {
      case 'insufficient_stock':
      case 'total_mismatch':
      case 'price_changed':
      case 'vendor_unavailable':
      case 'variant_unavailable':
        return new ConflictException(payload);
      case 'provider_unavailable':
        return new ServiceUnavailableException(payload);
      default:
        return new BadRequestException(payload);
    }
  }
}

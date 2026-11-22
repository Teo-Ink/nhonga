import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CheckoutService, type CheckoutView } from './checkout.service.js';
import { CheckoutMockDecide, CheckoutPackage, CheckoutTopup } from '@nhonga/shared';
import { ZodBody } from '../../common/zod-body.js';

function bearer(authz: string | undefined): string | null {
  return authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
}

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  /** Wallets the method picker may offer, and whether payments are simulated. */
  @Get('methods')
  methods(): { mode: string; methods: string[] } {
    return this.checkout.methods();
  }

  /** Start a wallet top-up; the client then redirects to `checkoutUrl`. */
  @Post('topup')
  @HttpCode(201)
  topup(
    @Body(new ZodBody(CheckoutTopup)) body: { amountCents?: unknown; method?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<CheckoutView> {
    const amount =
      typeof body.amountCents === 'number' ? body.amountCents : Number(body.amountCents);
    const method = typeof body.method === 'string' ? body.method : '';
    return this.checkout.startTopup(bearer(authz), amount, method);
  }

  /** Buy a wallet package; the client then redirects to `checkoutUrl`. */
  @Post('package')
  @HttpCode(201)
  buyPackage(
    @Body(new ZodBody(CheckoutPackage)) body: { packageId?: unknown; method?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<CheckoutView> {
    return this.checkout.startPackage(
      bearer(authz),
      typeof body.packageId === 'string' ? body.packageId : '',
      typeof body.method === 'string' ? body.method : '',
    );
  }

  /** Gateway callbacks. Raw bytes are needed for PaySuite's HMAC signature. */
  @Post('webhooks/:gateway')
  @HttpCode(200)
  async webhook(
    @Param('gateway') gateway: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ ok: true }> {
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    }
    await this.checkout.handleWebhook(gateway, headers, req.rawBody?.toString('utf8') ?? '');
    return { ok: true };
  }

  /** Dev simulator only (CHECKOUT_MODE=mock). */
  @Post('mock/:id')
  @HttpCode(200)
  mock(
    @Param('id') id: string,
    @Body(new ZodBody(CheckoutMockDecide)) body: { outcome?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<CheckoutView> {
    return this.checkout.mockDecide(
      bearer(authz),
      id,
      body.outcome === 'failed' ? 'failed' : 'paid',
    );
  }

  @Get(':id')
  get(@Param('id') id: string, @Headers('authorization') authz?: string): Promise<CheckoutView> {
    return this.checkout.get(bearer(authz), id);
  }
}

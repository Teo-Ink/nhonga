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
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AdError,
  AdsService,
  type CampaignAdmin,
  type Placement,
  type ServedAd,
} from './ads.service.js';
import { ADMIN_HEADER, assertAdmin } from '../../common/admin.js';
import { AuthService } from '../auth/auth.service.js';
import { AdBooking } from '@nhonga/shared';
import { ZodBody } from '../../common/zod-body.js';

interface BookBody {
  advertiserName?: unknown;
  advertiserContact?: unknown;
  imageUrl?: unknown;
  clickUrl?: unknown;
  headline?: unknown;
  placement?: unknown;
  categorySlug?: unknown;
  days?: unknown;
  paymentMethod?: unknown;
}

/** Display-ad serving, click tracking, and self-serve booking (house-ads). */
@Controller('ads')
export class AdsController {
  constructor(
    private readonly ads: AdsService,
    private readonly auth: AuthService,
  ) {}

  /** Serve a live creative for a slot (counts an impression). */
  @Get()
  async serve(
    @Query('placement') placement?: string,
    @Query('category') category?: string,
  ): Promise<{ ad: ServedAd | null }> {
    if (!placement) return { ad: null };
    const ad = await this.ads.serve(placement, category);
    return { ad };
  }

  /** Example rate card (cents/day per placement) for the booking UI. */
  @Get('plans')
  plans(): Record<Placement, number> {
    return this.ads.rateCard();
  }

  /** Ops/admin-lite: all campaigns with impressions/clicks. */
  @Get('admin')
  admin(@Headers(ADMIN_HEADER) adminToken?: string): Promise<CampaignAdmin[]> {
    assertAdmin(adminToken);
    return this.ads.listAdmin();
  }

  /** Book a campaign and pay (mock) — it goes live immediately. */
  @Post()
  @HttpCode(201)
  async book(
    @Body(new ZodBody(AdBooking)) body: BookBody,
    @Headers('authorization') authz?: string,
  ): Promise<{ id: string; priceCents: number; status: string; endsAt: string }> {
    // Booking needs an account, so every creative is traceable to a person.
    await this.requireUser(authz);
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
    const input = {
      advertiserName: str(body.advertiserName) ?? '',
      ...(str(body.advertiserContact) ? { advertiserContact: str(body.advertiserContact)! } : {}),
      imageUrl: str(body.imageUrl) ?? '',
      clickUrl: str(body.clickUrl) ?? '',
      ...(str(body.headline) ? { headline: str(body.headline)! } : {}),
      placement: (str(body.placement) ?? '') as Placement,
      ...(str(body.categorySlug) ? { categorySlug: str(body.categorySlug)! } : {}),
      days: Number(body.days),
    };
    try {
      return await this.ads.bookAndPay(input, str(body.paymentMethod) ?? '');
    } catch (e) {
      throw toHttp(e);
    }
  }

  private async requireUser(authz: string | undefined): Promise<void> {
    const token = authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
    try {
      await this.auth.me(token);
    } catch {
      throw new UnauthorizedException({ message: 'Inicie sessão para continuar.' });
    }
  }

  /** Count a click; returns the destination URL for the caller to redirect to. */
  @Post(':id/click')
  @HttpCode(200)
  async click(@Param('id') id: string): Promise<{ clickUrl: string }> {
    const url = await this.ads.recordClick(id);
    if (url === null) throw new NotFoundException({ message: 'No such ad' });
    return { clickUrl: url };
  }
}

function toHttp(e: unknown): HttpException {
  if (e instanceof AdError) {
    const payload = { error: 'Ad', message: e.message, code: e.code };
    if (e.code === 'not_found') return new NotFoundException(payload);
    if (e.code === 'unavailable') return new HttpException(payload, HttpStatus.SERVICE_UNAVAILABLE);
    return new BadRequestException(payload);
  }
  return e instanceof HttpException
    ? e
    : new HttpException({ message: 'Ad error' }, HttpStatus.INTERNAL_SERVER_ERROR);
}

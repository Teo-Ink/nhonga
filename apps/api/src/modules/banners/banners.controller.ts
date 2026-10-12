import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  StreamableFile,
} from '@nestjs/common';
import { BannerError, BannersService, type BannerVariant, type QuotaView } from './banners.service.js';
import { PRESETS } from './banner-render.js';

function bearer(authz: string | undefined): string | null {
  return authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
}

// AI Banner Studio. A seller generates promotional banners for an owned listing
// (template-composited server-side), previews variants, and applies one. The
// rendered SVG is public (used as the listing's image and in shared cards).
@Controller('banners')
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  /** The style presets the UI offers. */
  @Get('presets')
  presets(): { presets: readonly string[] } {
    return { presets: PRESETS };
  }

  @Get('quota')
  async quota(@Headers('authorization') authz?: string): Promise<QuotaView> {
    try {
      return await this.banners.quota(bearer(authz));
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Post('generate')
  @HttpCode(200)
  async generate(
    @Body() body: { productId?: unknown; ratio?: unknown; preset?: unknown; prompt?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<{ variants: BannerVariant[]; aiUsed: boolean; quota: QuotaView }> {
    const productId = typeof body.productId === 'string' ? body.productId : '';
    if (!productId) throw new HttpException({ message: 'productId is required' }, HttpStatus.BAD_REQUEST);
    const arg: { productId: string; ratio?: string; preset?: string; prompt?: string } = { productId };
    if (typeof body.ratio === 'string') arg.ratio = body.ratio;
    if (typeof body.preset === 'string') arg.preset = body.preset;
    if (typeof body.prompt === 'string') arg.prompt = body.prompt;
    try {
      return await this.banners.generate(bearer(authz), arg);
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Post('edit')
  @HttpCode(200)
  async edit(
    @Body()
    body: { bannerId?: unknown; headline?: unknown; subheadline?: unknown; cta?: unknown; preset?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<BannerVariant> {
    const bannerId = typeof body.bannerId === 'string' ? body.bannerId : '';
    if (!bannerId) throw new HttpException({ message: 'bannerId is required' }, HttpStatus.BAD_REQUEST);
    const patch: { headline?: string; subheadline?: string; cta?: string; preset?: string } = {};
    if (typeof body.headline === 'string') patch.headline = body.headline;
    if (typeof body.subheadline === 'string') patch.subheadline = body.subheadline;
    if (typeof body.cta === 'string') patch.cta = body.cta;
    if (typeof body.preset === 'string') patch.preset = body.preset;
    try {
      return await this.banners.edit(bearer(authz), bannerId, patch);
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Post('apply')
  @HttpCode(200)
  async apply(
    @Body() body: { bannerId?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<{ bannerId: string }> {
    const bannerId = typeof body.bannerId === 'string' ? body.bannerId : '';
    try {
      return await this.banners.apply(bearer(authz), bannerId);
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Post('unapply')
  @HttpCode(200)
  async unapply(
    @Body() body: { productId?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<{ ok: true }> {
    const productId = typeof body.productId === 'string' ? body.productId : '';
    try {
      return await this.banners.unapply(bearer(authz), productId);
    } catch (e) {
      throw toHttp(e);
    }
  }

  /** Public SVG — served with a long cache (banner content is immutable). */
  @Get(':id.svg')
  @Header('cache-control', 'public, max-age=31536000, immutable')
  async svg(@Param('id') id: string): Promise<StreamableFile> {
    const svg = await this.banners.svg(id.replace(/\.svg$/i, ''));
    if (!svg) throw new NotFoundException({ message: 'No such banner' });
    return new StreamableFile(Buffer.from(svg, 'utf-8'), {
      type: 'image/svg+xml; charset=utf-8',
      disposition: 'inline',
    });
  }
}

function toHttp(e: unknown): HttpException {
  if (e instanceof BannerError) {
    const status =
      e.code === 'invalid_input'
        ? HttpStatus.BAD_REQUEST
        : e.code === 'unauthenticated'
          ? HttpStatus.UNAUTHORIZED
          : e.code === 'forbidden'
            ? HttpStatus.FORBIDDEN
            : e.code === 'not_found'
              ? HttpStatus.NOT_FOUND
              : e.code === 'quota'
                ? HttpStatus.PAYMENT_REQUIRED
                : HttpStatus.BAD_REQUEST;
    return new HttpException({ message: e.message, code: e.code }, status);
  }
  if (e instanceof HttpException) return e;
  return new HttpException({ message: 'Erro ao gerar banner.' }, HttpStatus.INTERNAL_SERVER_ERROR);
}

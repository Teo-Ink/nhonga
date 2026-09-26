import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AdsService, type CampaignAdmin, type ServedAd } from './ads.service.js';

/** Display-ad serving + click tracking (house-ads monetisation). */
@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}

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

  /** Ops/admin-lite: all campaigns with impressions/clicks. */
  @Get('admin')
  admin(): Promise<CampaignAdmin[]> {
    return this.ads.listAdmin();
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

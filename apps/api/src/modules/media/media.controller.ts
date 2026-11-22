import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MediaService } from './media.service.js';

/**
 * Serves uploaded listing photos. Public and immutable (an id is never
 * reused), so browsers and any CDN may keep them for a year. With a CDN in
 * front of the bucket (MEDIA_CDN_URL), the API only answers with a redirect.
 */
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get(':id')
  async get(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const cdn = await this.media.cdnUrl(id);
    if (cdn) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.redirect(302, cdn);
      return;
    }
    const asset = await this.media.get(id);
    if (!asset) throw new NotFoundException({ message: 'No such media' });
    res.setHeader('Content-Type', asset.contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(asset.bytes);
  }
}

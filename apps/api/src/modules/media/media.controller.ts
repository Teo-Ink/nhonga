import { Controller, Get, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { MediaService } from './media.service.js';

/** Serves uploaded listing photos. Public, immutable, cacheable. */
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get(':id')
  async get(@Param('id') id: string): Promise<StreamableFile> {
    const asset = await this.media.get(id);
    if (!asset) throw new NotFoundException({ message: 'No such media' });
    return new StreamableFile(asset.bytes, {
      type: asset.contentType,
      disposition: 'inline',
    });
  }
}

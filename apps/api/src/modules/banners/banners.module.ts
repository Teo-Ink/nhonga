import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MediaModule } from '../media/media.module.js';
import { BannersController } from './banners.controller.js';
import { BannersService } from './banners.service.js';

// AI Banner Studio: Claude art-directs the copy + palette, a deterministic SVG
// renderer composes it with the listing's photo. Free monthly quota, extra
// generations spend wallet points, Loja Pro is unlimited and watermark-free.
@Module({
  imports: [AuthModule, MediaModule],
  controllers: [BannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}

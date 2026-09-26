import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller.js';
import { AdsService } from './ads.service.js';

// Display-ad campaigns (house-ads monetisation).
@Module({
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}

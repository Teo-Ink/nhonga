import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MEDIA_OBJECT_STORE, MediaService } from './media.service.js';
import { objectStoreFromEnv } from './object-store.js';

@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    // S3 when MEDIA_BUCKET is set (P1-03); otherwise photos stay in Postgres.
    { provide: MEDIA_OBJECT_STORE, useFactory: () => objectStoreFromEnv() },
  ],
  exports: [MediaService],
})
export class MediaModule {}

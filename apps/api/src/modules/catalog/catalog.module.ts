import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { FavoritesModule } from '../favorites/favorites.module.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  imports: [MediaModule, AuthModule, NotificationsModule, FavoritesModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}

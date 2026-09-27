import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { AlertsController } from './alerts.controller.js';
import { AlertsService } from './alerts.service.js';

// Reuses CatalogService (exported by CatalogModule) to match saved searches
// against live listings.
@Module({
  imports: [CatalogModule],
  controllers: [AlertsController],
  providers: [AlertsService],
})
export class AlertsModule {}

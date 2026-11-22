import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AlertsController } from './alerts.controller.js';
import { AlertsService } from './alerts.service.js';
import { AlertsSweeper } from './alerts.sweeper.js';

// Reuses CatalogService (match saved searches against live listings) and
// DeliveryService (SMS + push + in-app) from NotificationsModule. The sweeper
// runs the alert loop on an interval.
@Module({
  imports: [CatalogModule, NotificationsModule, AuthModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsSweeper],
})
export class AlertsModule {}

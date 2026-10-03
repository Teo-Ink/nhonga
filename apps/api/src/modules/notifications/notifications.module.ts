import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DeliveryService } from './delivery.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

// Exports NotificationsService (in-app notifications for the catalogue/reviews
// modules) and DeliveryService (SMS + push), which the alerts sweeper uses.
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, DeliveryService],
  exports: [NotificationsService, DeliveryService],
})
export class NotificationsModule {}

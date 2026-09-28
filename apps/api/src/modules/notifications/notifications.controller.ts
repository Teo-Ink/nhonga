import { Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { NotificationsService, type NotificationDto } from './notifications.service.js';

function bearer(authz: string | undefined): string | null {
  return authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
}

/** Seller notifications (new contact / new review). */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Headers('authorization') authz?: string,
  ): Promise<{ items: NotificationDto[]; unread: number }> {
    return this.notifications.list(bearer(authz));
  }

  @Post('read')
  @HttpCode(200)
  markRead(@Headers('authorization') authz?: string): Promise<{ ok: true }> {
    return this.notifications.markAllRead(bearer(authz));
  }
}

import { Body, Controller, Get, Headers, HttpCode, Post, Put } from '@nestjs/common';
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

  @Get('prefs')
  getPrefs(
    @Headers('authorization') authz?: string,
  ): Promise<{ contact: boolean; review: boolean }> {
    return this.notifications.getPrefs(bearer(authz));
  }

  @Put('prefs')
  setPrefs(
    @Body() body: { contact?: unknown; review?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<{ contact: boolean; review: boolean }> {
    return this.notifications.setPrefs(bearer(authz), {
      contact: body.contact !== false,
      review: body.review !== false,
    });
  }
}

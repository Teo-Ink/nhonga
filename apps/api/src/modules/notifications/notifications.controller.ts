import { Body, Controller, Get, Headers, HttpCode, Post, Put } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { DeliveryService } from './delivery.service.js';
import { NotificationsService, type NotificationDto } from './notifications.service.js';

function bearer(authz: string | undefined): string | null {
  return authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
}

/** Seller notifications (new contact / new review) + device push-token registry. */
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly auth: AuthService,
    private readonly delivery: DeliveryService,
  ) {}

  /** Register this device's Expo push token for the signed-in user. */
  @Post('push-token')
  @HttpCode(200)
  async registerPush(
    @Body() body: { token?: unknown; platform?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<{ ok: boolean }> {
    const session = bearer(authz);
    const token = typeof body.token === 'string' ? body.token : '';
    if (!session || !token) return { ok: false };
    let userId: string;
    try {
      userId = (await this.auth.me(session)).id;
    } catch {
      return { ok: false };
    }
    const platform = typeof body.platform === 'string' ? body.platform : 'unknown';
    await this.delivery.registerToken(userId, token, platform);
    return { ok: true };
  }

  /** Unregister a device token (e.g. on sign-out). */
  @Post('push-token/remove')
  @HttpCode(200)
  async removePush(@Body() body: { token?: unknown }): Promise<{ ok: true }> {
    if (typeof body.token === 'string' && body.token) await this.delivery.removeToken(body.token);
    return { ok: true };
  }

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

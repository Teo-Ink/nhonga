import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { devicePushToken } from '../../db/schema/notifications.js';
import { appUser } from '../../db/schema/identity.js';
import type { AppConfig } from '../../config/config.schema.js';
import { NotificationsService } from './notifications.service.js';
import { createSmsSender, type SmsSender } from './sms.sender.js';
import { createPushSender, type PushMessage, type PushSender } from './push.sender.js';

/**
 * The outbound delivery layer: SMS (gateway or mock) and native push (Expo or
 * mock), plus the device-token registry. Shared by the alerts sweeper and any
 * other trigger that wants to reach a user off-app. Both channels are
 * best-effort and default to mock, matching the OTP/payments demo posture.
 */
@Injectable()
export class DeliveryService {
  private readonly sms: SmsSender;
  private readonly push: PushSender;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly notifications: NotificationsService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.sms = createSmsSender({
      mode: config.get('smsMode', { infer: true }),
      gatewayUrl: config.get('smsGatewayUrl', { infer: true }),
      gatewayToken: config.get('smsGatewayToken', { infer: true }),
      senderId: config.get('smsSenderId', { infer: true }),
    });
    this.push = createPushSender({
      mode: config.get('pushMode', { infer: true }),
      accessToken: config.get('expoAccessToken', { infer: true }),
    });
  }

  // ── Device tokens ───────────────────────────────────────────────
  async registerToken(userId: string, token: string, platform: string): Promise<void> {
    const t = token.trim();
    if (!t) return;
    await this.db
      .insert(devicePushToken)
      .values({ token: t, userId, platform: platform || 'unknown', lastSeenAt: new Date() })
      .onConflictDoUpdate({
        target: devicePushToken.token,
        set: { userId, platform: platform || 'unknown', lastSeenAt: new Date() },
      });
  }

  async removeToken(token: string): Promise<void> {
    await this.db.delete(devicePushToken).where(eq(devicePushToken.token, token.trim()));
  }

  private async tokensForUser(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ token: devicePushToken.token })
      .from(devicePushToken)
      .where(eq(devicePushToken.userId, userId));
    return rows.map((r) => r.token);
  }

  private async userIdForPhone(phoneE164: string): Promise<string | null> {
    const rows = await this.db
      .select({ id: appUser.id })
      .from(appUser)
      .where(eq(appUser.phoneE164, phoneE164))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  // ── Sending ─────────────────────────────────────────────────────
  sendSms(toE164: string, message: string): Promise<{ sent: boolean; channel: string }> {
    return this.sms.send(toE164, message);
  }

  async pushToUser(userId: string, message: PushMessage): Promise<number> {
    const tokens = await this.tokensForUser(userId);
    if (tokens.length === 0) return 0;
    const res = await this.push.send(tokens, message);
    return res.accepted;
  }

  /** Resolve a phone to its signed-in user and push to all of their devices. */
  async pushToPhone(phoneE164: string, message: PushMessage): Promise<number> {
    const userId = await this.userIdForPhone(phoneE164);
    if (!userId) return 0;
    return this.pushToUser(userId, message);
  }

  /**
   * Fan a single alert out across every channel for a phone: SMS always (that's
   * all a guest left), plus — when the phone belongs to a signed-in user — a
   * native push to their devices and an in-app notification.
   */
  async notifyPhone(
    phoneE164: string,
    msg: { title: string; body: string; href?: string; smsText: string },
  ): Promise<{ sms: boolean; push: number; inApp: boolean }> {
    const userId = await this.userIdForPhone(phoneE164);
    const smsRes = await this.sms.send(phoneE164, msg.smsText);
    let push = 0;
    let inApp = false;
    if (userId) {
      push = await this.pushToUser(userId, {
        title: msg.title,
        body: msg.body,
        ...(msg.href ? { data: { href: msg.href } } : {}),
      });
      await this.notifications.notifyUser(userId, {
        type: 'saved_search',
        title: msg.title,
        body: msg.body,
        ...(msg.href ? { href: msg.href } : {}),
      });
      inApp = true;
    }
    return { sms: smsRes.sent, push, inApp };
  }
}

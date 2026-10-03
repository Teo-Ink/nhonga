import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { notification, notificationPref } from '../../db/schema/notifications.js';
import { vendorUser } from '../../db/schema/vendors.js';
import { AuthService } from '../auth/auth.service.js';

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  isRead: boolean;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly auth: AuthService,
  ) {}

  /** Create a notification for every owner/manager of a vendor. Best-effort. */
  async notifyVendorOwners(
    vendorId: string,
    n: { type: string; title: string; body?: string; href?: string },
  ): Promise<void> {
    try {
      const owners = await this.db
        .select({ userId: vendorUser.userId })
        .from(vendorUser)
        .where(eq(vendorUser.vendorId, vendorId));
      if (owners.length === 0) return;

      // Respect each recipient's preferences (default: everything on).
      const ownerIds = owners.map((o) => o.userId);
      const prefs = await this.db
        .select()
        .from(notificationPref)
        .where(inArray(notificationPref.userId, ownerIds));
      const prefMap = new Map(prefs.map((p) => [p.userId, p]));
      const recipients = ownerIds.filter((id) => {
        const p = prefMap.get(id);
        if (!p) return true;
        if (n.type === 'review') return p.reviewEnabled;
        if (n.type === 'contact') return p.contactEnabled;
        return true;
      });
      if (recipients.length === 0) return;

      await this.db.insert(notification).values(
        recipients.map((userId) => ({
          id: randomUUID(),
          userId,
          type: n.type,
          title: n.title,
          body: n.body ?? null,
          href: n.href ?? null,
        })),
      );
    } catch {
      // Notifications are best-effort; never fail the triggering action.
    }
  }

  /** Notify one specific user (e.g. the buyer in a conversation). Best-effort. */
  async notifyUser(
    userId: string,
    n: { type: string; title: string; body?: string; href?: string },
  ): Promise<void> {
    try {
      await this.db.insert(notification).values({
        id: randomUUID(),
        userId,
        type: n.type,
        title: n.title,
        body: n.body ?? null,
        href: n.href ?? null,
      });
    } catch {
      /* best-effort */
    }
  }

  async list(
    sessionToken: string | null,
  ): Promise<{ items: NotificationDto[]; unread: number }> {
    if (!sessionToken) return { items: [], unread: 0 };
    let userId: string;
    try {
      userId = (await this.auth.me(sessionToken)).id;
    } catch {
      return { items: [], unread: 0 };
    }
    const rows = await this.db
      .select()
      .from(notification)
      .where(eq(notification.userId, userId))
      .orderBy(desc(notification.createdAt))
      .limit(50);
    return {
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        href: r.href,
        isRead: r.isRead,
        createdAt: r.createdAt.toISOString(),
      })),
      unread: rows.filter((r) => !r.isRead).length,
    };
  }

  async getPrefs(sessionToken: string | null): Promise<{ contact: boolean; review: boolean }> {
    const on = { contact: true, review: true };
    if (!sessionToken) return on;
    let userId: string;
    try {
      userId = (await this.auth.me(sessionToken)).id;
    } catch {
      return on;
    }
    const p = (
      await this.db
        .select()
        .from(notificationPref)
        .where(eq(notificationPref.userId, userId))
        .limit(1)
    )[0];
    if (!p) return on;
    return { contact: p.contactEnabled, review: p.reviewEnabled };
  }

  async setPrefs(
    sessionToken: string | null,
    prefs: { contact: boolean; review: boolean },
  ): Promise<{ contact: boolean; review: boolean }> {
    if (!sessionToken) return prefs;
    const userId = (await this.auth.me(sessionToken)).id;
    await this.db
      .insert(notificationPref)
      .values({
        userId,
        contactEnabled: prefs.contact,
        reviewEnabled: prefs.review,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: notificationPref.userId,
        set: {
          contactEnabled: prefs.contact,
          reviewEnabled: prefs.review,
          updatedAt: new Date(),
        },
      });
    return prefs;
  }

  async markAllRead(sessionToken: string | null): Promise<{ ok: true }> {
    if (!sessionToken) return { ok: true };
    try {
      const userId = (await this.auth.me(sessionToken)).id;
      await this.db
        .update(notification)
        .set({ isRead: true })
        .where(and(eq(notification.userId, userId), eq(notification.isRead, false)));
    } catch {
      /* ignore */
    }
    return { ok: true };
  }
}

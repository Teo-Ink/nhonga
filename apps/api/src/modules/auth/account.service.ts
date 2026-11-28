import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { savedSearch } from '../../db/schema/alerts.js';
import { product } from '../../db/schema/catalog.js';
import { order as orderTable } from '../../db/schema/commerce.js';
import { favorite } from '../../db/schema/favorites.js';
import { address, appUser, refreshToken, userIdentity } from '../../db/schema/identity.js';
import { conversation, message } from '../../db/schema/messaging.js';
import { devicePushToken, notification, notificationPref } from '../../db/schema/notifications.js';
import { review } from '../../db/schema/reviews.js';
import { vendor, vendorUser } from '../../db/schema/vendors.js';
import { AuthService } from './auth.service.js';

export const DELETED_NAME = 'Conta eliminada';

/**
 * Account self-service required by the app stores and by data-protection law
 * (P0-06): delete my account, and download my data.
 *
 * Deletion takes effect at once, without the 30-day wait the schema once
 * planned: the stores require deletion "in the app", and keeping a phone number
 * for a month gives the person nothing. What stays is what others or the books
 * need: orders and payments (accounting), and messages and reviews already sent
 * to other people, now shown under "Conta eliminada".
 */
@Injectable()
export class AccountService {
  private readonly log = new Logger('Account');

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly auth: AuthService,
  ) {}

  async deleteAccount(rawToken: string | null): Promise<{ ok: true }> {
    const me = await this.auth.me(rawToken);
    const now = new Date();

    await this.db.transaction(async (tx) => {
      // Shops where this person is the only member close, and their listings
      // leave the site. A shop with other members carries on without them.
      const memberships = await tx
        .select({ vendorId: vendorUser.vendorId })
        .from(vendorUser)
        .where(eq(vendorUser.userId, me.id));
      const vendorIds = memberships.map((m) => m.vendorId);
      if (vendorIds.length > 0) {
        const counts = await tx
          .select({ vendorId: vendorUser.vendorId, n: sql<number>`count(*)::int` })
          .from(vendorUser)
          .where(inArray(vendorUser.vendorId, vendorIds))
          .groupBy(vendorUser.vendorId);
        const solo = counts.filter((c) => c.n === 1).map((c) => c.vendorId);
        if (solo.length > 0) {
          await tx
            .update(product)
            .set({ status: 'archived', updatedAt: now })
            .where(inArray(product.vendorId, solo));
          await tx
            .update(vendor)
            .set({
              status: 'closed',
              whatsapp: null,
              contactPhone: null,
              showWhatsapp: false,
              showPhone: false,
              updatedAt: now,
            })
            .where(inArray(vendor.id, solo));
        }
        await tx.delete(vendorUser).where(eq(vendorUser.userId, me.id));
      }

      if (me.phoneE164 !== null) {
        await tx.delete(savedSearch).where(eq(savedSearch.phoneE164, me.phoneE164));
      }
      await tx.delete(address).where(eq(address.userId, me.id));
      await tx.delete(favorite).where(eq(favorite.userId, me.id));
      await tx.delete(devicePushToken).where(eq(devicePushToken.userId, me.id));
      await tx.delete(notification).where(eq(notification.userId, me.id));
      await tx.delete(notificationPref).where(eq(notificationPref.userId, me.id));
      await tx
        .update(review)
        .set({ authorName: DELETED_NAME })
        .where(eq(review.authorUserId, me.id));

      // Google/Facebook links go too: the same provider account can open a
      // fresh Nhonga account later, and nothing ties it to this one (AUTH-10).
      await tx.delete(userIdentity).where(eq(userIdentity.userId, me.id));

      // Every session ends now, on every device.
      await tx
        .update(refreshToken)
        .set({ revokedAt: now })
        .where(and(eq(refreshToken.userId, me.id), sql`${refreshToken.revokedAt} is null`));

      // The number is freed, so it can open a new account later.
      await tx
        .update(appUser)
        .set({
          status: 'deleted',
          deletedAt: now,
          phoneE164: `deleted:${me.id}`,
          email: null,
          emailVerifiedAt: null,
          displayName: DELETED_NAME,
          updatedAt: now,
        })
        .where(eq(appUser.id, me.id));
    });

    this.log.log(`account_deleted user=${me.id}`);
    return { ok: true };
  }

  /** Everything we hold about the signed-in person, as one JSON document. */
  async exportData(rawToken: string | null): Promise<Record<string, unknown>> {
    const me = await this.auth.me(rawToken);
    const [user] = await this.db.select().from(appUser).where(eq(appUser.id, me.id));
    const shops = await this.db
      .select({ id: vendor.id, slug: vendor.slug, name: vendor.displayName, role: vendorUser.role })
      .from(vendorUser)
      .innerJoin(vendor, eq(vendor.id, vendorUser.vendorId))
      .where(eq(vendorUser.userId, me.id));
    const shopIds = shops.map((s) => s.id);
    const listings =
      shopIds.length === 0
        ? []
        : await this.db
            .select({
              slug: product.slug,
              title: product.titlePt,
              description: product.descriptionPt,
              status: product.status,
              createdAt: product.createdAt,
            })
            .from(product)
            .where(inArray(product.vendorId, shopIds));
    const sent = await this.db
      .select({ conversationId: message.conversationId, body: message.body, at: message.createdAt })
      .from(message)
      .where(eq(message.senderUserId, me.id));
    const asBuyer = await this.db
      .select({ id: conversation.id, about: conversation.productTitle })
      .from(conversation)
      .where(eq(conversation.buyerUserId, me.id));

    return {
      exportedAt: new Date().toISOString(),
      account: {
        id: user?.id,
        phone: user?.phoneE164 ?? null,
        signInProviders: me.providers,
        email: user?.email ?? null,
        displayName: user?.displayName,
        locale: user?.locale,
        createdAt: user?.createdAt,
      },
      shops: shops.map(({ id: _id, ...s }) => s),
      listings,
      favorites: await this.db
        .select({ productId: favorite.productId })
        .from(favorite)
        .where(eq(favorite.userId, me.id)),
      savedSearches:
        me.phoneE164 === null
          ? []
          : await this.db
              .select({
                label: savedSearch.label,
                href: savedSearch.href,
                createdAt: savedSearch.createdAt,
              })
              .from(savedSearch)
              .where(eq(savedSearch.phoneE164, me.phoneE164)),
      addresses: await this.db.select().from(address).where(eq(address.userId, me.id)),
      conversations: asBuyer,
      messagesSent: sent,
      reviewsWritten: await this.db
        .select({ rating: review.rating, createdAt: review.createdAt })
        .from(review)
        .where(eq(review.authorUserId, me.id)),
      orders: await this.db
        .select({
          number: orderTable.orderNumber,
          totalCents: orderTable.grandTotalCents,
          placedAt: orderTable.placedAt,
        })
        .from(orderTable)
        .where(eq(orderTable.userId, me.id)),
    };
  }
}

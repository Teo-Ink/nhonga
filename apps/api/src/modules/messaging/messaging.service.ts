import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { conversation, message, userBlock } from '../../db/schema/messaging.js';
import { vendor, vendorUser } from '../../db/schema/vendors.js';
import { product } from '../../db/schema/catalog.js';
import { appUser } from '../../db/schema/identity.js';
import { AuthService, type AuthUser } from '../auth/auth.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export class MessagingError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_input' | 'not_found' | 'forbidden' | 'blocked',
  ) {
    super(message);
    this.name = 'MessagingError';
  }
}

export interface ConversationDto {
  id: string;
  counterpart: string;
  productTitle: string | null;
  productSlug: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
  unread: number;
  role: 'buyer' | 'seller';
}
export interface MessageDto {
  id: string;
  mine: boolean;
  body: string;
  createdAt: string;
}

@Injectable()
export class MessagingService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly auth: AuthService,
    private readonly notifications: NotificationsService,
  ) {}

  private async me(token: string | null): Promise<AuthUser> {
    if (!token) throw new MessagingError('sign in required', 'forbidden');
    try {
      return await this.auth.me(token);
    } catch {
      throw new MessagingError('sign in required', 'forbidden');
    }
  }

  private async vendorIdsOf(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ vendorId: vendorUser.vendorId })
      .from(vendorUser)
      .where(eq(vendorUser.userId, userId));
    return rows.map((r) => r.vendorId);
  }

  /** Start (or reuse) a conversation with a shop and post the first message. */
  async start(
    input: { vendorSlug: string; productSlug?: string; body: string },
    token: string | null,
  ): Promise<{ id: string }> {
    const user = await this.me(token);
    const body = input.body.trim();
    if (body.length === 0) throw new MessagingError('empty message', 'invalid_input');

    const shop = (
      await this.db
        .select({ id: vendor.id })
        .from(vendor)
        .where(eq(vendor.slug, input.vendorSlug))
        .limit(1)
    )[0];
    if (!shop) throw new MessagingError('shop not found', 'not_found');
    await this.assertNotBlocked(user.id, shop.id);

    let productId: string | null = null;
    let productTitle: string | null = null;
    if (input.productSlug) {
      const p = (
        await this.db
          .select({ id: product.id, title: product.titlePt })
          .from(product)
          .where(and(eq(product.slug, input.productSlug), eq(product.vendorId, shop.id)))
          .limit(1)
      )[0];
      if (p) {
        productId = p.id;
        productTitle = p.title;
      }
    }

    // Reuse an existing thread for the same buyer/shop/listing.
    const existing = (
      await this.db
        .select({ id: conversation.id })
        .from(conversation)
        .where(
          and(
            eq(conversation.vendorId, shop.id),
            eq(conversation.buyerUserId, user.id),
            productId ? eq(conversation.productId, productId) : isNull(conversation.productId),
          ),
        )
        .limit(1)
    )[0];

    const convId = existing?.id ?? randomUUID();
    if (!existing) {
      await this.db.insert(conversation).values({
        id: convId,
        vendorId: shop.id,
        buyerUserId: user.id,
        productId,
        productTitle,
        lastMessageAt: new Date(),
        buyerLastReadAt: new Date(),
      });
    }
    await this.post(convId, user.id, body, { isBuyer: true, vendorId: shop.id });
    return { id: convId };
  }

  /** Append a message to a conversation the user takes part in. */
  async send(id: string, bodyRaw: string, token: string | null): Promise<{ ok: true }> {
    const user = await this.me(token);
    const body = bodyRaw.trim();
    if (body.length === 0) throw new MessagingError('empty message', 'invalid_input');
    const { conv, role } = await this.participant(id, user);
    await this.assertNotBlocked(conv.buyerUserId, conv.vendorId);
    await this.post(id, user.id, body, { isBuyer: role === 'buyer', vendorId: conv.vendorId });
    return { ok: true };
  }

  // ── Blocks (P0-18) ─────────────────────────────────────────────────────────

  /** Either side blocked the other: no new conversation, no new message. */
  private async assertNotBlocked(buyerUserId: string, vendorId: string): Promise<void> {
    const rows = await this.db
      .select({ id: userBlock.id })
      .from(userBlock)
      .where(
        or(
          and(eq(userBlock.blockerUserId, buyerUserId), eq(userBlock.blockedVendorId, vendorId)),
          and(
            eq(userBlock.blockedUserId, buyerUserId),
            inArray(
              userBlock.blockerUserId,
              this.db
                .select({ id: vendorUser.userId })
                .from(vendorUser)
                .where(eq(vendorUser.vendorId, vendorId)),
            ),
          ),
        ),
      )
      .limit(1);
    if (rows.length > 0) {
      throw new MessagingError('Esta conversa foi bloqueada.', 'blocked');
    }
  }

  /** Block the other side of a conversation: the shop (as buyer) or the buyer
   *  (as seller). The conversation disappears from the blocker's inbox. */
  async block(id: string, token: string | null): Promise<{ ok: true }> {
    const user = await this.me(token);
    const { conv, role } = await this.participant(id, user);
    await this.db
      .insert(userBlock)
      .values({
        id: randomUUID(),
        blockerUserId: user.id,
        ...(role === 'buyer'
          ? { blockedVendorId: conv.vendorId }
          : { blockedUserId: conv.buyerUserId }),
      })
      .onConflictDoNothing();
    return { ok: true };
  }

  async unblock(id: string, token: string | null): Promise<{ ok: true }> {
    const user = await this.me(token);
    const { conv, role } = await this.participant(id, user);
    await this.db
      .delete(userBlock)
      .where(
        and(
          eq(userBlock.blockerUserId, user.id),
          role === 'buyer'
            ? eq(userBlock.blockedVendorId, conv.vendorId)
            : eq(userBlock.blockedUserId, conv.buyerUserId),
        ),
      );
    return { ok: true };
  }

  private async post(
    convId: string,
    senderId: string,
    body: string,
    ctx: { isBuyer: boolean; vendorId: string },
  ): Promise<void> {
    await this.db
      .insert(message)
      .values({ id: randomUUID(), conversationId: convId, senderUserId: senderId, body });
    await this.db
      .update(conversation)
      .set({
        lastMessageAt: new Date(),
        ...(ctx.isBuyer ? { buyerLastReadAt: new Date() } : { sellerLastReadAt: new Date() }),
      })
      .where(eq(conversation.id, convId));

    const snippet = body.slice(0, 80);
    if (ctx.isBuyer) {
      await this.notifications.notifyVendorOwners(ctx.vendorId, {
        type: 'message',
        title: 'Nova mensagem',
        body: snippet,
        href: `/mensagens/${convId}`,
      });
    } else {
      const conv = (
        await this.db
          .select({ buyerUserId: conversation.buyerUserId })
          .from(conversation)
          .where(eq(conversation.id, convId))
          .limit(1)
      )[0];
      if (conv) {
        await this.notifications.notifyUser(conv.buyerUserId, {
          type: 'message',
          title: 'Nova mensagem',
          body: snippet,
          href: `/mensagens/${convId}`,
        });
      }
    }
  }

  private async participant(
    id: string,
    user: AuthUser,
  ): Promise<{ conv: typeof conversation.$inferSelect; role: 'buyer' | 'seller' }> {
    const conv = (
      await this.db.select().from(conversation).where(eq(conversation.id, id)).limit(1)
    )[0];
    if (!conv) throw new MessagingError('conversation not found', 'not_found');
    if (conv.buyerUserId === user.id) return { conv, role: 'buyer' };
    const vids = await this.vendorIdsOf(user.id);
    if (vids.includes(conv.vendorId)) return { conv, role: 'seller' };
    throw new MessagingError('not your conversation', 'forbidden');
  }

  async list(token: string | null): Promise<{ items: ConversationDto[]; unread: number }> {
    const user = await this.me(token);
    const vids = await this.vendorIdsOf(user.id);
    const cond =
      vids.length > 0
        ? or(eq(conversation.buyerUserId, user.id), inArray(conversation.vendorId, vids))
        : eq(conversation.buyerUserId, user.id);
    // Conversations with someone this user blocked are hidden from them.
    const notBlocked = sql`not exists (
      select 1 from user_block b
      where b.blocker_user_id = ${user.id}
        and (b.blocked_vendor_id = ${conversation.vendorId}
             or b.blocked_user_id = ${conversation.buyerUserId}))`;
    const isBuyer = sql`${conversation.buyerUserId} = ${user.id}`;

    // One query: last message and unread count as correlated subqueries (they
    // use message_conversation_idx), instead of two queries per conversation.
    const rows = await this.db
      .select({
        id: conversation.id,
        buyerUserId: conversation.buyerUserId,
        productTitle: conversation.productTitle,
        lastMessageAt: conversation.lastMessageAt,
        vendorName: vendor.displayName,
        buyerName: appUser.displayName,
        lastMessage: sql<string | null>`(
          select m.body from message m where m.conversation_id = ${conversation.id}
          order by m.created_at desc limit 1)`,
        unread: sql<number>`(
          select count(*)::int from message m
          where m.conversation_id = ${conversation.id}
            and m.sender_user_id <> ${user.id}
            and m.created_at > coalesce(
              case when ${isBuyer} then ${conversation.buyerLastReadAt}
                   else ${conversation.sellerLastReadAt} end,
              '-infinity'::timestamptz))`,
      })
      .from(conversation)
      .innerJoin(vendor, eq(conversation.vendorId, vendor.id))
      .innerJoin(appUser, eq(conversation.buyerUserId, appUser.id))
      .where(and(cond, notBlocked))
      .orderBy(desc(conversation.lastMessageAt))
      .limit(100);

    let unreadTotal = 0;
    const items: ConversationDto[] = rows.map((r) => {
      const role: 'buyer' | 'seller' = r.buyerUserId === user.id ? 'buyer' : 'seller';
      const n = Number(r.unread ?? 0);
      unreadTotal += n;
      return {
        id: r.id,
        counterpart: role === 'buyer' ? r.vendorName : r.buyerName,
        productTitle: r.productTitle,
        productSlug: null,
        lastMessage: r.lastMessage ?? null,
        lastMessageAt: new Date(r.lastMessageAt).toISOString(),
        unread: n,
        role,
      };
    });
    return { items, unread: unreadTotal };
  }

  async thread(
    id: string,
    token: string | null,
  ): Promise<{ counterpart: string; productTitle: string | null; messages: MessageDto[] }> {
    const user = await this.me(token);
    const { conv, role } = await this.participant(id, user);

    const [vrow, brow] = await Promise.all([
      this.db
        .select({ name: vendor.displayName })
        .from(vendor)
        .where(eq(vendor.id, conv.vendorId))
        .limit(1),
      this.db
        .select({ name: appUser.displayName })
        .from(appUser)
        .where(eq(appUser.id, conv.buyerUserId))
        .limit(1),
    ]);
    const counterpart = role === 'buyer' ? (vrow[0]?.name ?? '') : (brow[0]?.name ?? '');

    const rows = await this.db
      .select()
      .from(message)
      .where(eq(message.conversationId, id))
      .orderBy(asc(message.createdAt))
      .limit(500);

    // Mark this side read.
    await this.db
      .update(conversation)
      .set(role === 'buyer' ? { buyerLastReadAt: new Date() } : { sellerLastReadAt: new Date() })
      .where(eq(conversation.id, id));

    return {
      counterpart,
      productTitle: conv.productTitle,
      messages: rows.map((m) => ({
        id: m.id,
        mine: m.senderUserId === user.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }
}

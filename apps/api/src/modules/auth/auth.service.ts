import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { normaliseMzMsisdn } from '@nhonga/shared';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { appUser, otpChallenge, refreshToken } from '../../db/schema/identity.js';
import { referral } from '../../db/schema/referrals.js';
import { vendor, vendorUser } from '../../db/schema/vendors.js';
import { wallet, walletTransaction } from '../../db/schema/wallet.js';
import {
  order as orderTable,
  orderItem,
  payment as paymentTable,
  subOrder,
} from '../../db/schema/commerce.js';
import {
  generateOtpCode,
  hashOtpCode,
  hashSessionToken,
  newSessionToken,
  verifyOtpCode,
} from './auth-crypto.js';

export class AuthError extends Error {
  constructor(
    readonly code:
      | 'invalid_phone'
      | 'rate_limited'
      | 'challenge_not_found'
      | 'expired'
      | 'too_many_attempts'
      | 'wrong_code'
      | 'unauthenticated',
    readonly userMessage: string,
  ) {
    super(`${code}: ${userMessage}`);
    this.name = 'AuthError';
  }
}

export interface AuthUser {
  readonly id: string;
  readonly phoneE164: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly phoneVerified: boolean;
}

export interface OtpRequestResult {
  readonly challengeId: string;
  readonly expiresInSeconds: number;
  /** Present only in mock SMS mode, so the flow is testable without a gateway. */
  readonly devCode?: string;
}

export interface VerifyResult {
  readonly sessionToken: string;
  readonly expiresAt: string;
  readonly user: AuthUser;
}

const OTP_TTL_SECONDS = 600; // 10 minutes
const SESSION_TTL_DAYS = 7;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_WINDOW = 5;

/** Whether SMS is mocked. In mock mode we log the code and return it for testing. */
// Never mock in production, whatever SMS_MODE says (config validation also
// refuses to boot production with SMS_MODE=mock; this is a second lock).
const SMS_MOCK =
  process.env['NODE_ENV'] !== 'production' && (process.env['SMS_MODE'] ?? 'mock') !== 'live';

@Injectable()
export class AuthService {
  private readonly log = new Logger('Auth');

  constructor(@Inject(DB) private readonly db: Db) {}

  async requestOtp(phone: string): Promise<OtpRequestResult> {
    const phoneE164 = normaliseMzMsisdn(phone);
    if (phoneE164 === null) {
      throw new AuthError('invalid_phone', 'O número deve ter 9 dígitos e começar por 8.');
    }

    // Basic rate limit: cap active challenges per phone in the TTL window.
    const since = new Date(Date.now() - OTP_TTL_SECONDS * 1000);
    const recent = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(otpChallenge)
      .where(and(eq(otpChallenge.phoneE164, phoneE164), gt(otpChallenge.createdAt, since)));
    if ((recent[0]?.n ?? 0) >= MAX_REQUESTS_PER_WINDOW) {
      throw new AuthError('rate_limited', 'Pediu códigos demasiadas vezes. Tente mais tarde.');
    }

    const code = generateOtpCode();
    const challengeId = randomUUID();
    await this.db.insert(otpChallenge).values({
      id: challengeId,
      phoneE164,
      codeHash: hashOtpCode(code),
      purpose: 'login',
      maxAttempts: MAX_ATTEMPTS,
      expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
    });

    if (SMS_MOCK) {
      this.log.log(`[mock SMS] login code for ${phoneE164}: ${code}`);
    } else {
      // Live SMS gateway is not wired (OQ). Fail loud rather than silently drop.
      throw new AuthError('rate_limited', 'O envio de SMS ainda não está disponível.');
    }

    return {
      challengeId,
      expiresInSeconds: OTP_TTL_SECONDS,
      ...(SMS_MOCK ? { devCode: code } : {}),
    };
  }

  async verifyOtp(challengeId: string, code: string, referralCode?: string): Promise<VerifyResult> {
    const rows = await this.db
      .select()
      .from(otpChallenge)
      .where(eq(otpChallenge.id, challengeId))
      .limit(1);
    const ch = rows[0];
    if (ch === undefined) {
      throw new AuthError('challenge_not_found', 'Pedido de código inválido. Comece de novo.');
    }
    if (ch.consumedAt !== null) {
      throw new AuthError('challenge_not_found', 'Este código já foi usado. Comece de novo.');
    }
    if (ch.expiresAt.getTime() < Date.now()) {
      throw new AuthError('expired', 'O código expirou. Peça um novo.');
    }
    if (ch.attempts >= ch.maxAttempts) {
      throw new AuthError('too_many_attempts', 'Demasiadas tentativas. Peça um novo código.');
    }

    if (!verifyOtpCode(code.trim(), ch.codeHash)) {
      await this.db
        .update(otpChallenge)
        .set({ attempts: ch.attempts + 1 })
        .where(eq(otpChallenge.id, challengeId));
      throw new AuthError('wrong_code', 'Código incorreto. Verifique e tente novamente.');
    }

    await this.db
      .update(otpChallenge)
      .set({ consumedAt: new Date() })
      .where(eq(otpChallenge.id, challengeId));

    const { user, created } = await this.upsertUser(ch.phoneE164);
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000);
    await this.db.insert(refreshToken).values({
      id: randomUUID(),
      userId: user.id,
      tokenHash: token.hash,
      familyId: randomUUID(),
      deviceLabel: 'web',
      expiresAt,
    });

    // Referral attribution happens once, only for a brand-new account. Never let
    // it break sign-in.
    if (created && referralCode) {
      await this.recordReferral(user.id, referralCode).catch((e) =>
        this.log.warn(`referral attribution failed: ${e instanceof Error ? e.message : e}`),
      );
    }

    return { sessionToken: token.raw, expiresAt: expiresAt.toISOString(), user };
  }

  async me(rawToken: string | null): Promise<AuthUser> {
    const userId = await this.userIdForToken(rawToken);
    const rows = await this.db
      .select()
      .from(appUser)
      .where(and(eq(appUser.id, userId), eq(appUser.status, 'active')))
      .limit(1);
    const u = rows[0];
    if (u === undefined) throw new AuthError('unauthenticated', 'Sessão inválida.');
    return toAuthUser(u);
  }

  async logout(rawToken: string | null): Promise<void> {
    if (!rawToken) return;
    await this.db
      .update(refreshToken)
      .set({ revokedAt: new Date() })
      .where(eq(refreshToken.tokenHash, hashSessionToken(rawToken)));
  }

  async listOrders(rawToken: string | null): Promise<
    ReadonlyArray<{
      orderNumber: string;
      placedAt: string;
      grandTotalCents: number;
      paymentStatus: string;
      itemCount: number;
    }>
  > {
    const userId = await this.userIdForToken(rawToken);
    const orders = await this.db
      .select({
        id: orderTable.id,
        orderNumber: orderTable.orderNumber,
        placedAt: orderTable.placedAt,
        grandTotalCents: orderTable.grandTotalCents,
        paymentStatus: paymentTable.status,
        itemCount: sql<number>`(
          select coalesce(sum(${orderItem.quantity}), 0)::int
          from ${orderItem}
          join ${subOrder} on ${subOrder.id} = ${orderItem.subOrderId}
          where ${subOrder.orderId} = ${orderTable.id}
        )`,
      })
      .from(orderTable)
      .leftJoin(paymentTable, eq(paymentTable.orderId, orderTable.id))
      .where(eq(orderTable.userId, userId))
      .orderBy(desc(orderTable.placedAt))
      .limit(50);

    return orders.map((o) => ({
      orderNumber: o.orderNumber,
      placedAt: o.placedAt.toISOString(),
      grandTotalCents: o.grandTotalCents,
      paymentStatus: o.paymentStatus ?? 'unknown',
      itemCount: o.itemCount,
    }));
  }

  private async userIdForToken(rawToken: string | null): Promise<string> {
    if (!rawToken) throw new AuthError('unauthenticated', 'Inicie sessão para continuar.');
    const hash = hashSessionToken(rawToken);
    const rows = await this.db
      .select({ userId: refreshToken.userId })
      .from(refreshToken)
      .where(
        and(
          eq(refreshToken.tokenHash, hash),
          isNull(refreshToken.revokedAt),
          gt(refreshToken.expiresAt, new Date()),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (row === undefined)
      throw new AuthError('unauthenticated', 'Sessão expirada. Inicie sessão.');
    return row.userId;
  }

  private async upsertUser(phoneE164: string): Promise<{ user: AuthUser; created: boolean }> {
    const existing = await this.db
      .select()
      .from(appUser)
      .where(and(eq(appUser.phoneE164, phoneE164), isNull(appUser.deletedAt)))
      .limit(1);
    if (existing[0]) {
      if (existing[0].phoneVerifiedAt === null) {
        await this.db
          .update(appUser)
          .set({ phoneVerifiedAt: new Date() })
          .where(eq(appUser.id, existing[0].id));
      }
      return {
        user: toAuthUser({
          ...existing[0],
          phoneVerifiedAt: existing[0].phoneVerifiedAt ?? new Date(),
        }),
        created: false,
      };
    }

    const id = randomUUID();
    const displayName = `Cliente ${phoneE164.slice(-4)}`;
    await this.db
      .insert(appUser)
      .values({ id, phoneE164, displayName, phoneVerifiedAt: new Date(), status: 'active' })
      .onConflictDoNothing({ target: appUser.phoneE164 });
    const rows = await this.db
      .select()
      .from(appUser)
      .where(eq(appUser.phoneE164, phoneE164))
      .limit(1);
    // onConflictDoNothing means a race could find an existing row — treat a row
    // whose id matches the one we generated as the freshly created account.
    return { user: toAuthUser(rows[0]!), created: rows[0]!.id === id };
  }

  // ── Referrals (H) ─────────────────────────────────────────────────
  private static readonly REFERRAL_POINTS = 20;

  /** The short invite code for a user id: the first UUID block, uppercased. */
  private static codeForUser(id: string): string {
    return id.replace(/-/g, '').slice(0, 8).toUpperCase();
  }

  /** Attribute a new signup to the referrer the code resolves to, and reward
   *  the referrer with loyalty points if they have a seller wallet. */
  private async recordReferral(referredUserId: string, rawCode: string): Promise<void> {
    const code = rawCode
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 8)
      .toLowerCase();
    if (code.length !== 8) return;
    // The code is the first UUID segment — match a user whose id starts with it.
    const referrer = (
      await this.db
        .select({ id: appUser.id })
        .from(appUser)
        .where(sql`replace(${appUser.id}::text, '-', '') like ${`${code}%`}`)
        .limit(1)
    )[0];
    if (!referrer || referrer.id === referredUserId) return;

    // Reward only if the referrer is a seller (points live in the seller wallet).
    const sellerVendor = (
      await this.db
        .select({ vendorId: vendorUser.vendorId })
        .from(vendorUser)
        .innerJoin(vendor, eq(vendor.id, vendorUser.vendorId))
        .where(eq(vendorUser.userId, referrer.id))
        .limit(1)
    )[0];
    const rewarded = sellerVendor != null;
    const points = rewarded ? AuthService.REFERRAL_POINTS : 0;

    await this.db
      .insert(referral)
      .values({
        id: randomUUID(),
        referrerUserId: referrer.id,
        referredUserId,
        code: code.toUpperCase(),
        rewardPoints: points,
        status: rewarded ? 'rewarded' : 'pending',
      })
      .onConflictDoNothing({ target: referral.referredUserId });

    if (rewarded && sellerVendor) {
      await this.db
        .insert(wallet)
        .values({ vendorId: sellerVendor.vendorId })
        .onConflictDoNothing();
      await this.db
        .update(wallet)
        .set({ points: sql`${wallet.points} + ${points}`, updatedAt: sql`now()` })
        .where(eq(wallet.vendorId, sellerVendor.vendorId));
      await this.db.insert(walletTransaction).values({
        id: randomUUID(),
        vendorId: sellerVendor.vendorId,
        kind: 'purchase',
        amountCents: 0,
        points,
        description: 'Recompensa de convite',
      });
    }
  }

  /** A signed-in user's referral stats (as a referrer). */
  async referralSummary(rawToken: string | null): Promise<{
    code: string;
    friends: number;
    rewarded: number;
    pointsEarned: number;
  }> {
    const userId = await this.userIdForToken(rawToken);
    const rows = await this.db
      .select({ status: referral.status, points: referral.rewardPoints })
      .from(referral)
      .where(eq(referral.referrerUserId, userId));
    return {
      code: AuthService.codeForUser(userId),
      friends: rows.length,
      rewarded: rows.filter((r) => r.status === 'rewarded').length,
      pointsEarned: rows.reduce((n, r) => n + (r.points ?? 0), 0),
    };
  }
}

function toAuthUser(u: {
  id: string;
  phoneE164: string;
  displayName: string;
  email: string | null;
  phoneVerifiedAt: Date | null;
}): AuthUser {
  return {
    id: u.id,
    phoneE164: u.phoneE164,
    displayName: u.displayName,
    email: u.email,
    phoneVerified: u.phoneVerifiedAt !== null,
  };
}

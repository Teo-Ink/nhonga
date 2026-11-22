import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { normaliseMzMsisdn } from '@nhonga/shared';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { appUser, otpChallenge, refreshToken } from '../../db/schema/identity.js';
import { referral } from '../../db/schema/referrals.js';
import { vendor, vendorUser } from '../../db/schema/vendors.js';
import { wallet, walletTransaction } from '../../db/schema/wallet.js';
import {
  generateOtpCode,
  hashOtpCode,
  hashSessionToken,
  newSessionToken,
  verifyOtpCode,
} from './auth-crypto.js';
import { breachMessage, checkOtpLimits, otpLimitsFromEnv, type OtpLimits } from './otp-limits.js';
import { createSmsSender, type SmsSender } from '../notifications/sms.sender.js';

export class AuthError extends Error {
  constructor(
    readonly code:
      | 'invalid_phone'
      | 'rate_limited'
      | 'challenge_not_found'
      | 'expired'
      | 'too_many_attempts'
      | 'wrong_code'
      | 'unauthenticated'
      | 'not_allowed'
      | 'sms_unavailable',
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

/** Whether SMS is mocked. In mock mode we log the code and return it for testing. */
// Never mock in production, whatever SMS_MODE says (config validation also
// refuses to boot production with SMS_MODE=mock; this is a second lock).
const SMS_MOCK =
  process.env['NODE_ENV'] !== 'production' && (process.env['SMS_MODE'] ?? 'mock') !== 'live';

/**
 * Test environments (staging) with mocked SMS hand the login code back in the
 * response, which lets anyone sign in as any number. OTP_DEV_ALLOWLIST limits
 * that to the team's own numbers (P0-05): any other number is refused before a
 * code exists. Empty = no restriction, for a developer's own machine.
 */
export function parseAllowlist(raw: string | undefined): ReadonlySet<string> {
  const out = new Set<string>();
  for (const part of (raw ?? '').split(/[,;]+/)) {
    const n = normaliseMzMsisdn(part);
    if (n !== null) out.add(n);
  }
  return out;
}

export function otpSmsText(code: string): string {
  return `Nhonga: o seu código é ${code}. Válido 10 minutos. Não o partilhe com ninguém.`;
}

@Injectable()
export class AuthService {
  private readonly log = new Logger('Auth');

  private readonly limits: OtpLimits = otpLimitsFromEnv();
  private readonly devAllowlist = parseAllowlist(process.env['OTP_DEV_ALLOWLIST']);
  private readonly sms: SmsSender = createSmsSender({
    mode: SMS_MOCK ? 'mock' : 'live',
    gatewayUrl: process.env['SMS_GATEWAY_URL'] ?? null,
    gatewayToken: process.env['SMS_GATEWAY_TOKEN'] ?? null,
    senderId: process.env['SMS_SENDER_ID'] ?? null,
  });

  constructor(@Inject(DB) private readonly db: Db) {}

  async requestOtp(phone: string): Promise<OtpRequestResult> {
    const phoneE164 = normaliseMzMsisdn(phone);
    if (phoneE164 === null) {
      throw new AuthError('invalid_phone', 'O número deve ter 9 dígitos e começar por 8.');
    }

    if (SMS_MOCK && this.devAllowlist.size > 0 && !this.devAllowlist.has(phoneE164)) {
      throw new AuthError(
        'not_allowed',
        'Este ambiente de testes só aceita números autorizados pela equipa Nhonga.',
      );
    }

    // Limits counted in Postgres, so they hold across every API instance (SEC-02).
    const usage = await this.otpUsage(phoneE164);
    const breach = checkOtpLimits(usage, this.limits);
    if (breach !== null) {
      if (breach.kind === 'global_hour') {
        // Stable marker for a CloudWatch metric filter and alarm (SMS pumping).
        this.log.warn(`ALERT otp_global_limit_reached count=${usage.globalLastHour}`);
      } else {
        this.log.log(`otp_limited kind=${breach.kind}`);
      }
      throw new AuthError('rate_limited', breachMessage(breach));
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
      this.log.log(`[mock SMS] login code issued for …${phoneE164.slice(-3)}`);
    } else {
      const res = await this.sms.send(phoneE164, otpSmsText(code));
      if (!res.sent || res.channel !== 'live') {
        // Nothing reached the phone: burn the challenge so it cannot be guessed,
        // and say so instead of leaving the user waiting for an SMS.
        await this.db
          .update(otpChallenge)
          .set({ consumedAt: new Date() })
          .where(eq(otpChallenge.id, challengeId));
        throw new AuthError(
          'sms_unavailable',
          'Não foi possível enviar o SMS agora. Tente de novo dentro de alguns minutos.',
        );
      }
    }

    return {
      challengeId,
      expiresInSeconds: OTP_TTL_SECONDS,
      ...(SMS_MOCK ? { devCode: code } : {}),
    };
  }

  async verifyOtp(challengeId: string, code: string, referralCode?: string): Promise<VerifyResult> {
    // Claim one attempt atomically BEFORE checking the code (SEC-01). Concurrent
    // guesses each need their own row update, so at most max_attempts of them
    // ever get to compare a code, however many arrive at once.
    const claimed = await this.db
      .update(otpChallenge)
      .set({ attempts: sql`${otpChallenge.attempts} + 1` })
      .where(
        and(
          eq(otpChallenge.id, challengeId),
          sql`${otpChallenge.attempts} < ${otpChallenge.maxAttempts}`,
          isNull(otpChallenge.consumedAt),
          gt(otpChallenge.expiresAt, sql`now()`),
        ),
      )
      .returning({ phoneE164: otpChallenge.phoneE164, codeHash: otpChallenge.codeHash });
    const ch = claimed[0];
    if (ch === undefined) throw await this.whyNoAttempt(challengeId);

    if (!verifyOtpCode(code.trim(), ch.codeHash)) {
      throw new AuthError('wrong_code', 'Código incorreto. Verifique e tente novamente.');
    }

    // Consume atomically: of two correct submissions racing, exactly one wins
    // and only that one gets a session.
    const consumed = await this.db
      .update(otpChallenge)
      .set({ consumedAt: sql`now()` })
      .where(and(eq(otpChallenge.id, challengeId), isNull(otpChallenge.consumedAt)))
      .returning({ id: otpChallenge.id });
    if (consumed.length === 0) {
      throw new AuthError('challenge_not_found', 'Este código já foi usado. Comece de novo.');
    }

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

  private async otpUsage(phoneE164: string) {
    const rows = await this.db
      .select({
        lastAt: sql<Date | null>`max(${otpChallenge.createdAt}) filter (where ${otpChallenge.phoneE164} = ${phoneE164})`,
        inWindow: sql<number>`count(*) filter (where ${otpChallenge.phoneE164} = ${phoneE164} and ${otpChallenge.createdAt} > now() - make_interval(secs => ${OTP_TTL_SECONDS}))::int`,
        today: sql<number>`count(*) filter (where ${otpChallenge.phoneE164} = ${phoneE164} and ${otpChallenge.createdAt} > now() - interval '24 hours')::int`,
        globalHour: sql<number>`count(*) filter (where ${otpChallenge.createdAt} > now() - interval '1 hour')::int`,
      })
      .from(otpChallenge)
      .where(gt(otpChallenge.createdAt, sql`now() - interval '24 hours'`));
    const r = rows[0];
    const lastAt = r?.lastAt ? new Date(r.lastAt) : null;
    return {
      secondsSinceLast: lastAt === null ? null : (Date.now() - lastAt.getTime()) / 1000,
      perNumberInWindow: r?.inWindow ?? 0,
      perNumberToday: r?.today ?? 0,
      globalLastHour: r?.globalHour ?? 0,
    };
  }

  /** Explains why no attempt could be claimed, for the user-facing message. */
  private async whyNoAttempt(challengeId: string): Promise<AuthError> {
    const rows = await this.db
      .select({
        attempts: otpChallenge.attempts,
        maxAttempts: otpChallenge.maxAttempts,
        expiresAt: otpChallenge.expiresAt,
        consumedAt: otpChallenge.consumedAt,
      })
      .from(otpChallenge)
      .where(eq(otpChallenge.id, challengeId))
      .limit(1);
    const ch = rows[0];
    if (ch === undefined) {
      return new AuthError('challenge_not_found', 'Pedido de código inválido. Comece de novo.');
    }
    if (ch.consumedAt !== null) {
      return new AuthError('challenge_not_found', 'Este código já foi usado. Comece de novo.');
    }
    if (ch.attempts >= ch.maxAttempts) {
      return new AuthError('too_many_attempts', 'Demasiadas tentativas. Peça um novo código.');
    }
    return new AuthError('expired', 'O código expirou. Peça um novo.');
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
      if (existing[0].status !== 'active') {
        throw new AuthError(
          'not_allowed',
          'Esta conta está suspensa. Contacte o apoio da Nhonga se acha que é um engano.',
        );
      }
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

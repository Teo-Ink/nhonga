import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { otpChallenge, refreshToken } from '../../db/schema/identity.js';
import type { Db } from '../../db/types.js';
import { hasTestDb, migrateTestDb, openTestDb } from '../../test/pg.js';
import { AuthError, AuthService } from './auth.service.js';

// SEC-01: the attempt limit and single use of a code must hold under
// concurrency, not only for sequential requests.
describe.skipIf(!hasTestDb)('AuthService.verifyOtp under concurrency (Postgres)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let auth: AuthService;

  beforeAll(() => {
    migrateTestDb();
    ({ db, close } = openTestDb());
    auth = new AuthService(db);
  });
  afterAll(async () => close());

  // A distinct number per test, so the per-number request limit never interferes.
  const freshPhone = () => `84${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;

  it('20 wrong guesses in parallel record at most 5 attempts', async () => {
    const { challengeId, devCode } = await auth.requestOtp(freshPhone());
    const wrong = devCode === '000000' ? '111111' : '000000';

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => auth.verifyOtp(challengeId, wrong)),
    );

    const codes = results.map((r) =>
      r.status === 'rejected' && r.reason instanceof AuthError ? r.reason.code : 'other',
    );
    expect(codes.filter((c) => c === 'wrong_code')).toHaveLength(5);
    expect(codes.filter((c) => c === 'too_many_attempts')).toHaveLength(15);

    const [row] = await db
      .select({ attempts: otpChallenge.attempts })
      .from(otpChallenge)
      .where(eq(otpChallenge.id, challengeId));
    expect(row?.attempts).toBe(5);

    // Even the right code is refused once the attempts are spent.
    await expect(auth.verifyOtp(challengeId, devCode ?? '')).rejects.toMatchObject({
      code: 'too_many_attempts',
    });
  });

  it('two correct verifications in parallel create exactly one session', async () => {
    const { challengeId, devCode } = await auth.requestOtp(freshPhone());

    const results = await Promise.allSettled([
      auth.verifyOtp(challengeId, devCode ?? ''),
      auth.verifyOtp(challengeId, devCode ?? ''),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(1);

    const userId = (ok[0] as PromiseFulfilledResult<{ user: { id: string } }>).value.user.id;
    const sessions = await db
      .select({ id: refreshToken.id })
      .from(refreshToken)
      .where(eq(refreshToken.userId, userId));
    expect(sessions).toHaveLength(1);
  });

  it('a used code cannot be reused', async () => {
    const { challengeId, devCode } = await auth.requestOtp(freshPhone());
    await auth.verifyOtp(challengeId, devCode ?? '');
    await expect(auth.verifyOtp(challengeId, devCode ?? '')).rejects.toMatchObject({
      code: 'challenge_not_found',
    });
  });
});

// SEC-02: limits counted in Postgres, so they hold across API instances.
describe.skipIf(!hasTestDb)('AuthService.requestOtp limits (Postgres)', () => {
  let db: Db;
  let close: () => Promise<void>;

  beforeAll(() => {
    migrateTestDb();
    ({ db, close } = openTestDb());
  });
  afterAll(async () => close());

  const freshPhone = () => `85${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;

  it('refuses a resend inside the cooldown, from any instance', async () => {
    const a = new AuthService(db);
    const b = new AuthService(db); // a second API task sharing the database
    const phone = freshPhone();
    await a.requestOtp(phone);
    await expect(b.requestOtp(phone)).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('caps codes per number per day', async () => {
    const phone = freshPhone();
    process.env['OTP_RESEND_COOLDOWN_SECONDS'] = '1';
    process.env['OTP_MAX_PER_NUMBER_DAY'] = '2';
    process.env['OTP_MAX_PER_NUMBER_WINDOW'] = '50';
    try {
      const auth = new AuthService(db);
      // Backdate earlier codes past the cooldown instead of sleeping.
      await auth.requestOtp(phone);
      await db.execute(
        sql`update otp_challenge set created_at = now() - interval '5 minutes' where phone_e164 = ${'+258' + phone}`,
      );
      await auth.requestOtp(phone);
      await db.execute(
        sql`update otp_challenge set created_at = now() - interval '5 minutes' where phone_e164 = ${'+258' + phone}`,
      );
      await expect(auth.requestOtp(phone)).rejects.toMatchObject({
        code: 'rate_limited',
        userMessage: expect.stringContaining('por hoje'),
      });
    } finally {
      delete process.env['OTP_RESEND_COOLDOWN_SECONDS'];
      delete process.env['OTP_MAX_PER_NUMBER_DAY'];
      delete process.env['OTP_MAX_PER_NUMBER_WINDOW'];
    }
  });

  it('trips the global hourly limit', async () => {
    process.env['OTP_MAX_GLOBAL_HOUR'] = '1';
    try {
      const auth = new AuthService(db);
      // The table already holds codes from earlier tests in the last hour.
      await expect(auth.requestOtp(freshPhone())).rejects.toMatchObject({
        code: 'rate_limited',
        userMessage: expect.stringContaining('temporariamente'),
      });
    } finally {
      delete process.env['OTP_MAX_GLOBAL_HOUR'];
    }
  });
});

// P0-05: with an allowlist, a test environment only signs in the team's numbers.
describe.skipIf(!hasTestDb)('AuthService staging allowlist (Postgres)', () => {
  let db: Db;
  let close: () => Promise<void>;

  beforeAll(() => {
    migrateTestDb();
    ({ db, close } = openTestDb());
  });
  afterAll(async () => {
    delete process.env['OTP_DEV_ALLOWLIST'];
    await close();
  });

  it('refuses numbers outside the list and serves the ones on it', async () => {
    process.env['OTP_DEV_ALLOWLIST'] = '841234567, +258 85 765 4321';
    const auth = new AuthService(db);
    await expect(auth.requestOtp('846666666')).rejects.toMatchObject({ code: 'not_allowed' });
    const ok = await auth.requestOtp('857654321');
    expect(ok.devCode).toMatch(/^\d{6}$/);
  });
});

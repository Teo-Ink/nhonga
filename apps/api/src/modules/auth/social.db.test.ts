// AUTH-10: sign in with Google/Facebook, linking, and confirming a phone.
// The provider is a fake; everything on our side runs against Postgres.
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appUser, otpChallenge, userIdentity } from '../../db/schema/identity.js';
import type { Db } from '../../db/types.js';
import { hasTestDb, migrateTestDb, openTestDb } from '../../test/pg.js';
import { AccountService } from './account.service.js';
import { AuthError, AuthService } from './auth.service.js';
import { SocialAuthService, providerConfigFromEnv } from './social.service.js';

const CLIENT_ID = '123-abc.apps.googleusercontent.com';
const ENV = {
  GOOGLE_CLIENT_ID: CLIENT_ID,
  GOOGLE_CLIENT_SECRET: 'google-secret-0123456789',
  FACEBOOK_APP_ID: '1234567890',
  FACEBOOK_APP_SECRET: 'facebook-secret-0123456789',
  PUBLIC_WEB_URL: 'https://staging.nhonga.co.mz/',
};
const jwt = (claims: Record<string, unknown>) =>
  `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;

describe('provider configuration', () => {
  it('is off without real values, so the buttons do not show', () => {
    expect(providerConfigFromEnv('google', {})).toBeNull();
    expect(
      providerConfigFromEnv('google', {
        GOOGLE_CLIENT_ID: CLIENT_ID,
        GOOGLE_CLIENT_SECRET: 'definir-chave',
      }),
    ).toBeNull();
    expect(
      providerConfigFromEnv('google', {
        GOOGLE_CLIENT_ID: 'definir-chave',
        GOOGLE_CLIENT_SECRET: 'x'.repeat(24),
      }),
    ).toBeNull();
    expect(providerConfigFromEnv('facebook', ENV)).toEqual({
      clientId: '1234567890',
      clientSecret: 'facebook-secret-0123456789',
    });
  });
});

describe.skipIf(!hasTestDb)('Google/Facebook sign-in (Postgres)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let auth: AuthService;
  let social: SocialAuthService;
  /** Who the fake Google says is signing in. */
  let person = { sub: 'g-1', name: 'Ana Macuácua', email: 'ana@example.com' };
  const unique = () => Math.random().toString(36).slice(2, 10);
  const freshPhone = () => `84${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;

  beforeAll(() => {
    migrateTestDb();
    ({ db, close } = openTestDb());
    auth = new AuthService(db);
    social = new SocialAuthService(db, auth);
    social.env = ENV;
    social.fetchImpl = async (url) => {
      if (url.includes('googleapis.com/token')) {
        return {
          status: 200,
          text: async () =>
            JSON.stringify({
              id_token: jwt({
                iss: 'https://accounts.google.com',
                aud: CLIENT_ID,
                exp: Date.now() / 1000 + 600,
                nonce: 'n'.repeat(20),
                sub: person.sub,
                name: person.name,
                email: person.email,
                email_verified: true,
              }),
            }),
        };
      }
      const body = url.includes('/oauth/access_token')
        ? { access_token: 't' }
        : url.includes('/debug_token')
          ? { data: { is_valid: true, app_id: '1234567890', user_id: person.sub } }
          : { id: person.sub, name: person.name };
      return { status: 200, text: async () => JSON.stringify(body) };
    };
  });
  afterAll(async () => close());

  /** Pretend the per-number wait between two codes has passed. */
  const waitOutCooldown = (phone: string) =>
    db
      .update(otpChallenge)
      .set({ createdAt: sql`now() - interval '5 minutes'` })
      .where(eq(otpChallenge.phoneE164, `+258${phone}`));

  const complete = { code: 'c', nonce: 'n'.repeat(20), codeVerifier: 'v'.repeat(20) };
  const signInAs = (sub: string, name = 'Ana Macuácua') => {
    person = { sub, name, email: `${sub}@example.com` };
    return social.signIn('google', complete);
  };

  it('lists the configured providers and always redirects to our own address', () => {
    expect(social.providers()).toEqual(['google', 'facebook']);
    const s = social.start('google');
    const url = new URL(s.url);
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://staging.nhonga.co.mz/api/auth/social/google/callback',
    );
    expect(url.searchParams.get('state')).toBe(s.state);
    expect(s.state).not.toBe(social.start('google').state);
  });

  it('opens a new account without a phone on the first sign-in', async () => {
    const out = await signInAs(`g-${unique()}`);
    expect(out.created).toBe(true);
    expect(out.user).toMatchObject({
      phoneE164: null,
      phoneVerified: false,
      displayName: 'Ana Macuácua',
      providers: ['google'],
    });
    expect((await auth.me(out.sessionToken)).id).toBe(out.user.id);
  });

  it('signs the same person into the same account next time', async () => {
    const sub = `g-${unique()}`;
    const first = await signInAs(sub);
    const again = await signInAs(sub, 'Nome Mudado');
    expect(again.created).toBe(false);
    expect(again.user.id).toBe(first.user.id);
    expect(again.user.displayName).toBe('Ana Macuácua');
  });

  it('never joins accounts because an e-mail matches', async () => {
    const a = await signInAs(`g-${unique()}`);
    person = {
      sub: `g-${unique()}`,
      name: 'Outra Pessoa',
      email: a.user.email ?? 'ana@example.com',
    };
    const b = await social.signIn('google', complete);
    expect(b.user.id).not.toBe(a.user.id);
  });

  it('two first sign-ins at once end up as one account', async () => {
    const sub = `g-${unique()}`;
    person = { sub, name: 'Ana', email: null as unknown as string };
    const [x, y] = await Promise.all([
      social.signIn('google', complete),
      social.signIn('google', complete),
    ]);
    expect(x.user.id).toBe(y.user.id);
    const rows = await db.select().from(userIdentity).where(eq(userIdentity.subject, sub));
    expect(rows).toHaveLength(1);
  });

  it('cleans a display name that carries markup or control characters', async () => {
    const out = await signInAs(`g-${unique()}`, '  <b>Zé</b>\n\tdas   Couves ');
    expect(out.user.displayName).toBe('b Zé /b das Couves');
  });

  it('refuses a suspended account', async () => {
    const sub = `g-${unique()}`;
    const first = await signInAs(sub);
    await db.update(appUser).set({ status: 'suspended' }).where(eq(appUser.id, first.user.id));
    await expect(signInAs(sub)).rejects.toMatchObject({ code: 'not_allowed' });
  });

  describe('confirming a phone', () => {
    it('adds the number to the account, which can then sign in by SMS too', async () => {
      const g = await signInAs(`g-${unique()}`);
      const phone = freshPhone();
      const { challengeId, devCode } = await auth.requestPhoneLink(g.sessionToken, phone);
      const me = await auth.verifyPhoneLink(g.sessionToken, challengeId, devCode ?? '');
      expect(me).toMatchObject({ phoneE164: `+258${phone}`, phoneVerified: true });

      await waitOutCooldown(phone);
      const login = await auth.requestOtp(phone);
      const session = await auth.verifyOtp(login.challengeId, login.devCode ?? '');
      expect(session.user.id).toBe(g.user.id);
      expect(session.user.providers).toEqual(['google']);
    });

    it('refuses a number that already has a Nhonga account', async () => {
      const phone = freshPhone();
      const login = await auth.requestOtp(phone);
      await auth.verifyOtp(login.challengeId, login.devCode ?? '');

      const g = await signInAs(`g-${unique()}`);
      await waitOutCooldown(phone);
      const { challengeId, devCode } = await auth.requestPhoneLink(g.sessionToken, phone);
      await expect(
        auth.verifyPhoneLink(g.sessionToken, challengeId, devCode ?? ''),
      ).rejects.toMatchObject({ code: 'phone_in_use' });
      expect((await auth.me(g.sessionToken)).phoneE164).toBeNull();
    });

    it('a code sent to confirm a number cannot be used to sign in, or the reverse', async () => {
      const g = await signInAs(`g-${unique()}`);
      const link = await auth.requestPhoneLink(g.sessionToken, freshPhone());
      await expect(auth.verifyOtp(link.challengeId, link.devCode ?? '')).rejects.toBeInstanceOf(
        AuthError,
      );
      const login = await auth.requestOtp(freshPhone());
      await expect(
        auth.verifyPhoneLink(g.sessionToken, login.challengeId, login.devCode ?? ''),
      ).rejects.toBeInstanceOf(AuthError);
      expect((await auth.me(g.sessionToken)).phoneE164).toBeNull();
      // The right code still works for what it was issued for.
      expect(
        (await auth.verifyOtp(login.challengeId, login.devCode ?? '')).user.phoneVerified,
      ).toBe(true);
    });

    it('needs a session', async () => {
      await expect(auth.requestPhoneLink(null, freshPhone())).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });
  });

  describe('linking from the account page', () => {
    const phoneAccount = async () => {
      const login = await auth.requestOtp(freshPhone());
      return auth.verifyOtp(login.challengeId, login.devCode ?? '');
    };

    it('attaches Google to a phone account, and that Google then opens it', async () => {
      const p = await phoneAccount();
      const sub = `g-${unique()}`;
      person = { sub, name: 'Ana', email: 'ana@example.com' };
      const me = await social.link(p.sessionToken, 'google', complete);
      expect(me.providers).toEqual(['google']);
      expect((await signInAs(sub)).user.id).toBe(p.user.id);
    });

    it('refuses a Google account that already belongs to another Nhonga account', async () => {
      const sub = `g-${unique()}`;
      await signInAs(sub);
      const p = await phoneAccount();
      person = { sub, name: 'Ana', email: 'ana@example.com' };
      await expect(social.link(p.sessionToken, 'google', complete)).rejects.toMatchObject({
        code: 'identity_in_use',
      });
    });

    it('unlinks, but never the last way into the account', async () => {
      const g = await signInAs(`g-${unique()}`);
      await expect(social.unlink(g.sessionToken, 'google')).rejects.toMatchObject({
        code: 'last_sign_in_method',
      });

      const phone = freshPhone();
      const { challengeId, devCode } = await auth.requestPhoneLink(g.sessionToken, phone);
      await auth.verifyPhoneLink(g.sessionToken, challengeId, devCode ?? '');
      expect((await social.unlink(g.sessionToken, 'google')).providers).toEqual([]);
    });

    it('a second provider is another way in', async () => {
      const g = await signInAs(`g-${unique()}`);
      person = { sub: `f-${unique()}`, name: 'Ana', email: '' };
      expect((await social.link(g.sessionToken, 'facebook', complete)).providers).toEqual([
        'facebook',
        'google',
      ]);
      expect((await social.unlink(g.sessionToken, 'google')).providers).toEqual(['facebook']);
    });
  });

  it('deleting the account removes the link, and the data export names the providers', async () => {
    const sub = `g-${unique()}`;
    const g = await signInAs(sub);
    const account = new AccountService(db, auth);
    const exported = (await account.exportData(g.sessionToken)) as {
      account: { phone: unknown; signInProviders: unknown };
    };
    expect(exported.account).toMatchObject({ phone: null, signInProviders: ['google'] });

    await account.deleteAccount(g.sessionToken);
    expect(await db.select().from(userIdentity).where(eq(userIdentity.subject, sub))).toHaveLength(
      0,
    );
    // The same Google account can open a fresh account afterwards.
    const again = await signInAs(sub);
    expect(again.created).toBe(true);
    expect(again.user.id).not.toBe(g.user.id);
  });
});

import { describe, expect, it } from 'vitest';
import {
  SocialError,
  decodeJwtClaims,
  facebookAuthorizeUrl,
  facebookExchange,
  googleAuthorizeUrl,
  googleExchange,
  pkceChallenge,
  type SocialFetch,
} from './social-providers';

const GOOGLE = { clientId: '123-abc.apps.googleusercontent.com', clientSecret: 's'.repeat(24) };
const FB = { clientId: '1234567890', clientSecret: 'f'.repeat(32) };
const NOW = 1_800_000_000_000;
const input = {
  code: 'one-time-code',
  redirectUri: 'https://nhonga.co.mz/api/auth/social/google/callback',
  nonce: 'nonce-nonce-nonce-1',
  codeVerifier: 'verifier-verifier-verifier',
};

const jwt = (claims: Record<string, unknown>) =>
  `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;
const goodClaims = {
  iss: 'https://accounts.google.com',
  aud: GOOGLE.clientId,
  exp: NOW / 1000 + 600,
  nonce: input.nonce,
  sub: 'google-sub-1',
  email: 'ana@example.com',
  email_verified: true,
  name: 'Ana Macuácua',
};
const google =
  (claims: Record<string, unknown>, status = 200): SocialFetch =>
  async () => ({ status, text: async () => JSON.stringify({ id_token: jwt(claims) }) });

describe('Google', () => {
  it('sends the browser to Google with state, nonce and a PKCE challenge, never the verifier', () => {
    const url = new URL(googleAuthorizeUrl(GOOGLE, { ...input, state: 'state-1' }));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    const p = Object.fromEntries(url.searchParams);
    expect(p).toMatchObject({
      client_id: GOOGLE.clientId,
      redirect_uri: input.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: 'state-1',
      nonce: input.nonce,
      code_challenge: pkceChallenge(input.codeVerifier),
      code_challenge_method: 'S256',
    });
    expect(url.toString()).not.toContain(input.codeVerifier);
    expect(url.toString()).not.toContain(GOOGLE.clientSecret);
  });

  it('exchanges the code with the secret and the verifier, and returns the profile', async () => {
    let sent = '';
    const fetchImpl: SocialFetch = async (url, init) => {
      expect(url).toBe('https://oauth2.googleapis.com/token');
      sent = init.body ?? '';
      return { status: 200, text: async () => JSON.stringify({ id_token: jwt(goodClaims) }) };
    };
    const profile = await googleExchange(GOOGLE, input, fetchImpl, NOW);
    expect(profile).toEqual({
      subject: 'google-sub-1',
      email: 'ana@example.com',
      name: 'Ana Macuácua',
    });
    const body = Object.fromEntries(new URLSearchParams(sent));
    expect(body).toMatchObject({
      code: input.code,
      client_secret: GOOGLE.clientSecret,
      code_verifier: input.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
    });
  });

  it.each([
    ['another app', { aud: 'other.apps.googleusercontent.com' }],
    ['another issuer', { iss: 'https://evil.example' }],
    ['an expired token', { exp: NOW / 1000 - 1 }],
    ['a replayed code (nonce of another sign-in)', { nonce: 'someone-elses-nonce' }],
    ['no subject', { sub: '' }],
  ])('refuses an id_token for %s', async (_name, change) => {
    await expect(
      googleExchange(GOOGLE, input, google({ ...goodClaims, ...change }), NOW),
    ).rejects.toMatchObject({ reason: 'invalid_identity' });
  });

  it('ignores an e-mail Google has not verified', async () => {
    const p = await googleExchange(
      GOOGLE,
      input,
      google({ ...goodClaims, email_verified: false }),
      NOW,
    );
    expect(p.email).toBeNull();
  });

  it('tells a refusal from an outage', async () => {
    const refused: SocialFetch = async () => ({
      status: 400,
      text: async () => JSON.stringify({ error: 'invalid_grant' }),
    });
    await expect(googleExchange(GOOGLE, input, refused, NOW)).rejects.toMatchObject({
      reason: 'provider_rejected',
    });
    const down: SocialFetch = async () => {
      throw new Error('ECONNRESET');
    };
    await expect(googleExchange(GOOGLE, input, down, NOW)).rejects.toMatchObject({
      reason: 'provider_unavailable',
    });
    await expect(
      googleExchange(GOOGLE, input, async () => ({ status: 503, text: async () => '' }), NOW),
    ).rejects.toBeInstanceOf(SocialError);
  });

  it('reads claims and survives garbage', () => {
    expect(decodeJwtClaims(jwt({ a: 1 }))).toEqual({ a: 1 });
    expect(decodeJwtClaims('not-a-jwt')).toBeNull();
    expect(decodeJwtClaims('a.%%%.c')).toBeNull();
  });
});

describe('Facebook', () => {
  const answers = (over: Partial<Record<'token' | 'debug' | 'me', unknown>> = {}): SocialFetch => {
    const a = {
      token: { access_token: 'fb-token' },
      debug: { data: { is_valid: true, app_id: FB.clientId, user_id: 'fb-1' } },
      me: { id: 'fb-1', name: 'João Sitoe', email: 'joao@example.com' },
      ...over,
    };
    return async (url) => {
      const body = url.includes('/oauth/access_token')
        ? a.token
        : url.includes('/debug_token')
          ? a.debug
          : a.me;
      return { status: 200, text: async () => JSON.stringify(body) };
    };
  };

  it('sends the browser to Facebook with state and no secret', () => {
    const url = new URL(facebookAuthorizeUrl(FB, { ...input, state: 'state-9' }));
    expect(url.origin + url.pathname).toBe('https://www.facebook.com/dialog/oauth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: FB.clientId,
      state: 'state-9',
      scope: 'public_profile,email',
      response_type: 'code',
    });
    expect(url.toString()).not.toContain(FB.clientSecret);
  });

  it('returns the profile when the token was issued for this app and this person', async () => {
    expect(await facebookExchange(FB, input, answers())).toEqual({
      subject: 'fb-1',
      email: 'joao@example.com',
      name: 'João Sitoe',
    });
  });

  it('refuses a token minted for another app', async () => {
    await expect(
      facebookExchange(
        FB,
        input,
        answers({ debug: { data: { is_valid: true, app_id: '999', user_id: 'fb-1' } } }),
      ),
    ).rejects.toMatchObject({ reason: 'invalid_identity' });
  });

  it('refuses an invalid token and a profile that is not the token owner', async () => {
    await expect(
      facebookExchange(
        FB,
        input,
        answers({ debug: { data: { is_valid: false, app_id: FB.clientId, user_id: 'fb-1' } } }),
      ),
    ).rejects.toMatchObject({ reason: 'invalid_identity' });
    await expect(
      facebookExchange(FB, input, answers({ me: { id: 'fb-2', name: 'Outro' } })),
    ).rejects.toMatchObject({ reason: 'invalid_identity' });
  });

  it('works without an e-mail (many Facebook accounts have none)', async () => {
    const p = await facebookExchange(FB, input, answers({ me: { id: 'fb-1', name: 'João' } }));
    expect(p.email).toBeNull();
  });
});

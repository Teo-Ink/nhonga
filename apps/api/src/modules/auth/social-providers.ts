/**
 * Sign in with Google or Facebook (AUTH-10): the provider side.
 *
 * Both use the OAuth 2.0 authorization-code flow. The browser is sent to the
 * provider with a `state` it must bring back; the provider returns a one-time
 * `code`; this server exchanges it, with the client secret, for the person's
 * stable id, name and e-mail. The secret and the tokens never reach the
 * browser, and no provider token is stored.
 *
 * Google adds PKCE and a nonce: the id_token it returns must carry the nonce
 * this server chose, so a code issued for another sign-in cannot be replayed.
 * The id_token comes straight from Google's token endpoint over TLS, so its
 * claims (issuer, audience, expiry, nonce) are checked here and its signature
 * is not re-verified, as OpenID Connect Core §3.1.3.7 allows for that case.
 */
import { createHash } from 'node:crypto';

export type SocialProvider = 'google' | 'facebook';
export const SOCIAL_PROVIDERS: readonly SocialProvider[] = ['google', 'facebook'];

export interface SocialProfile {
  /** The provider's stable id for the person. */
  readonly subject: string;
  readonly email: string | null;
  readonly name: string | null;
}

export interface FetchResponse {
  readonly status: number;
  text(): Promise<string>;
}
export type SocialFetch = (
  url: string,
  init: { method: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<FetchResponse>;

export interface ProviderConfig {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface AuthorizeInput {
  readonly redirectUri: string;
  readonly state: string;
  readonly nonce: string;
  /** PKCE verifier; the URL carries only its SHA-256. */
  readonly codeVerifier: string;
}
export interface ExchangeInput {
  readonly code: string;
  readonly redirectUri: string;
  readonly nonce: string;
  readonly codeVerifier: string;
}

export class SocialError extends Error {
  constructor(
    readonly reason: 'provider_rejected' | 'provider_unavailable' | 'invalid_identity',
    detail: string,
  ) {
    super(detail);
    this.name = 'SocialError';
  }
}

const TIMEOUT_MS = 8000;

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function query(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

async function readJson(res: FetchResponse): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await res.text());
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function call(
  fetchImpl: SocialFetch,
  url: string,
  init: { method: string; headers?: Record<string, string>; body?: string },
): Promise<{ status: number; json: Record<string, unknown> }> {
  let res: FetchResponse;
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new SocialError('provider_unavailable', 'no answer from the provider');
  }
  if (res.status >= 500) throw new SocialError('provider_unavailable', `status ${res.status}`);
  return { status: res.status, json: await readJson(res) };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

// ── Google ──────────────────────────────────────────────────────────────────

const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

export function googleAuthorizeUrl(cfg: ProviderConfig, input: AuthorizeInput): string {
  return `https://accounts.google.com/o/oauth2/v2/auth?${query({
    client_id: cfg.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: input.state,
    nonce: input.nonce,
    code_challenge: pkceChallenge(input.codeVerifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })}`;
}

/** The claims of an id_token, without checking its signature (see the header). */
export function decodeJwtClaims(jwt: string): Record<string, unknown> | null {
  const part = jwt.split('.')[1];
  if (!part) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function googleExchange(
  cfg: ProviderConfig,
  input: ExchangeInput,
  fetchImpl: SocialFetch,
  nowMs: number,
): Promise<SocialProfile> {
  const { status, json } = await call(fetchImpl, 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: query({
      code: input.code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: input.codeVerifier,
    }),
  });
  const idToken = str(json['id_token']);
  if (status !== 200 || !idToken)
    throw new SocialError(
      'provider_rejected',
      `google token ${status} ${str(json['error']) ?? ''}`,
    );

  const c = decodeJwtClaims(idToken);
  if (!c) throw new SocialError('invalid_identity', 'unreadable id_token');
  const aud = c['aud'];
  const audOk = aud === cfg.clientId || (Array.isArray(aud) && aud.includes(cfg.clientId));
  if (!GOOGLE_ISSUERS.has(String(c['iss'])) || !audOk)
    throw new SocialError('invalid_identity', 'id_token for another issuer or app');
  if (typeof c['exp'] !== 'number' || c['exp'] * 1000 < nowMs)
    throw new SocialError('invalid_identity', 'expired id_token');
  if (c['nonce'] !== input.nonce) throw new SocialError('invalid_identity', 'nonce mismatch');
  const subject = str(c['sub']);
  if (!subject) throw new SocialError('invalid_identity', 'no subject');
  return {
    subject,
    // Only an address Google itself has verified.
    email: c['email_verified'] === true ? str(c['email']) : null,
    name: str(c['name']),
  };
}

// ── Facebook ────────────────────────────────────────────────────────────────

export function facebookAuthorizeUrl(cfg: ProviderConfig, input: AuthorizeInput): string {
  return `https://www.facebook.com/dialog/oauth?${query({
    client_id: cfg.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: 'public_profile,email',
    state: input.state,
  })}`;
}

export async function facebookExchange(
  cfg: ProviderConfig,
  input: ExchangeInput,
  fetchImpl: SocialFetch,
): Promise<SocialProfile> {
  const token = await call(
    fetchImpl,
    `https://graph.facebook.com/oauth/access_token?${query({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
    })}`,
    { method: 'GET' },
  );
  const accessToken = str(token.json['access_token']);
  if (token.status !== 200 || !accessToken)
    throw new SocialError('provider_rejected', `facebook token ${token.status}`);

  // The token must have been issued for this app: a token minted for another
  // app (and stolen from it) must not sign anyone in here.
  const debug = await call(
    fetchImpl,
    `https://graph.facebook.com/debug_token?${query({
      input_token: accessToken,
      access_token: `${cfg.clientId}|${cfg.clientSecret}`,
    })}`,
    { method: 'GET' },
  );
  const data = (debug.json['data'] ?? {}) as Record<string, unknown>;
  if (debug.status !== 200 || data['is_valid'] !== true || String(data['app_id']) !== cfg.clientId)
    throw new SocialError('invalid_identity', 'facebook token is not for this app');

  const me = await call(
    fetchImpl,
    `https://graph.facebook.com/me?${query({ fields: 'id,name,email', access_token: accessToken })}`,
    { method: 'GET' },
  );
  const subject = str(me.json['id']);
  if (me.status !== 200 || !subject || subject !== String(data['user_id']))
    throw new SocialError('invalid_identity', 'facebook profile does not match the token');
  return { subject, email: str(me.json['email']), name: str(me.json['name']) };
}

// Sign in with Google or Facebook (AUTH-10): what the site keeps between
// sending the browser to the provider and getting it back.
//
// The API issues `state`, `nonce` and `codeVerifier`. They travel in one
// httpOnly cookie, so page scripts never see them, and the provider only ever
// sees `state`. On return the `state` in the URL must equal the one in the
// cookie: that is what proves the answer belongs to a sign-in this browser
// started (and not to a link someone else crafted).

export const SOCIAL_COOKIE = 'nhonga_social';
export const SOCIAL_COOKIE_MAX_AGE = 600; // 10 minutes to finish at the provider
export const SOCIAL_PROVIDERS = ['google', 'facebook'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export interface PendingSocial {
  provider: SocialProvider;
  state: string;
  nonce: string;
  codeVerifier: string;
  /** Where to go after signing in (an internal path). */
  next: string;
  /** "link" attaches the provider to the signed-in account. */
  mode: 'signin' | 'link';
}

export function isSocialProvider(v: string): v is SocialProvider {
  return (SOCIAL_PROVIDERS as readonly string[]).includes(v);
}

/** Only our own paths: never an address taken from the query string as is. */
export function safeNext(raw: string | null | undefined, fallback = '/conta'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  if (raw.startsWith('/api/')) return fallback;
  return raw.length > 300 ? fallback : raw;
}

export function encodePending(p: PendingSocial): string {
  return Buffer.from(JSON.stringify(p), 'utf8').toString('base64url');
}

export function decodePending(raw: string | undefined): PendingSocial | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<PendingSocial>;
    if (
      typeof p.provider !== 'string' ||
      !isSocialProvider(p.provider) ||
      typeof p.state !== 'string' ||
      typeof p.nonce !== 'string' ||
      typeof p.codeVerifier !== 'string' ||
      p.state.length < 16
    )
      return null;
    return {
      provider: p.provider,
      state: p.state,
      nonce: p.nonce,
      codeVerifier: p.codeVerifier,
      next: safeNext(p.next),
      mode: p.mode === 'link' ? 'link' : 'signin',
    };
  } catch {
    return null;
  }
}

/** Same length and same characters, compared without stopping early. */
export function sameState(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type CallbackCheck =
  | { ok: true; pending: PendingSocial; code: string }
  | { ok: false; reason: 'cancelled' | 'expired' | 'state_mismatch' | 'wrong_provider' };

/** Decides whether a return from the provider may be completed. */
export function checkCallback(
  provider: string,
  params: URLSearchParams,
  cookie: string | undefined,
): CallbackCheck {
  const pending = decodePending(cookie);
  if (!pending) return { ok: false, reason: 'expired' };
  if (pending.provider !== provider) return { ok: false, reason: 'wrong_provider' };
  const state = params.get('state') ?? '';
  if (!sameState(state, pending.state)) return { ok: false, reason: 'state_mismatch' };
  const code = params.get('code');
  // The person pressed "cancel" at the provider, or it reported an error.
  if (!code || params.get('error')) return { ok: false, reason: 'cancelled' };
  return { ok: true, pending, code };
}

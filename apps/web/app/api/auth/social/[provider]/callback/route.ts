// Step 2: the provider sends the browser back here with a one-time code.
// The state is checked against the cookie, the API exchanges the code, and
// the session cookie is set exactly as for a phone sign-in.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, readJson } from '../../../../../../lib/bff';
import { sessionCookie } from '../../../../../../lib/session-cookie';
import { SOCIAL_COOKIE, checkCallback } from '../../../../../../lib/social-login';
import { siteOrigin } from '../../../../../../lib/site';

const REFERRAL_COOKIE = 'nhonga_ref';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider } = await ctx.params;
  const origin = await siteOrigin();
  const jar = await cookies();
  const check = checkCallback(
    provider,
    new URL(req.url).searchParams,
    jar.get(SOCIAL_COOKIE)?.value,
  );

  const done = (path: string): NextResponse => {
    const out = NextResponse.redirect(`${origin}${path}`, 303);
    // One use only, whatever happened.
    out.cookies.set(SOCIAL_COOKIE, '', { path: '/api/auth/social', maxAge: 0 });
    return out;
  };
  if (!check.ok) {
    return done(check.reason === 'cancelled' ? '/entrar' : '/entrar?erro=social');
  }
  const { pending, code } = check;
  const body = { code, nonce: pending.nonce, codeVerifier: pending.codeVerifier };

  try {
    if (pending.mode === 'link') {
      const token = jar.get(SESSION_COOKIE)?.value;
      if (!token) return done('/entrar?erro=social');
      const res = await apiFetch(`/auth/social/${provider}/link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      if (res.ok) return done('/conta/privacidade?ligado=1');
      const err = (await readJson<{ code?: string }>(res)) ?? {};
      return done(`/conta/privacidade?erro=${err.code === 'identity_in_use' ? 'em-uso' : 'ligar'}`);
    }

    const referralCode = jar.get(REFERRAL_COOKIE)?.value;
    const res = await apiFetch(`/auth/social/${provider}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'pt' },
      body: JSON.stringify(referralCode ? { ...body, referralCode } : body),
      cache: 'no-store',
    });
    const data = (await readJson<{ sessionToken?: string; code?: string }>(res)) ?? {};
    if (!res.ok || !data.sessionToken) {
      return done(`/entrar?erro=${data.code === 'not_allowed' ? 'suspensa' : 'social'}`);
    }
    const out = done(pending.next);
    out.cookies.set(sessionCookie(data.sessionToken));
    if (referralCode) out.cookies.set(REFERRAL_COOKIE, '', { path: '/', maxAge: 0 });
    return out;
  } catch {
    return done('/entrar?erro=social');
  }
}

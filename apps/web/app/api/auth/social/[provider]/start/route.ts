// Step 1 of Google/Facebook sign-in: get a provider URL from the API, remember
// state/nonce/verifier in an httpOnly cookie, and send the browser there.
import { NextResponse } from 'next/server';
import { apiFetch, readJson } from '../../../../../../lib/bff';
import { cookieSecure } from '../../../../../../lib/session-cookie';
import {
  SOCIAL_COOKIE,
  SOCIAL_COOKIE_MAX_AGE,
  encodePending,
  isSocialProvider,
  safeNext,
} from '../../../../../../lib/social-login';
import { siteOrigin } from '../../../../../../lib/site';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider } = await ctx.params;
  const origin = await siteOrigin();
  const url = new URL(req.url);
  const failed = NextResponse.redirect(`${origin}/entrar?erro=social`, 303);
  if (!isSocialProvider(provider)) return failed;

  let data: { url?: string; state?: string; nonce?: string; codeVerifier?: string } | null = null;
  try {
    const res = await apiFetch(`/auth/social/${provider}/start`, {
      method: 'POST',
      cache: 'no-store',
    });
    data = res.ok ? await readJson(res) : null;
  } catch {
    data = null;
  }
  if (!data?.url || !data.state || !data.nonce || !data.codeVerifier) return failed;

  const out = NextResponse.redirect(data.url, 303);
  out.cookies.set(
    SOCIAL_COOKIE,
    encodePending({
      provider,
      state: data.state,
      nonce: data.nonce,
      codeVerifier: data.codeVerifier,
      next: safeNext(url.searchParams.get('next')),
      mode: url.searchParams.get('mode') === 'link' ? 'link' : 'signin',
    }),
    {
      httpOnly: true,
      // Lax: the cookie must come back on the provider's redirect to us.
      sameSite: 'lax',
      path: '/api/auth/social',
      maxAge: SOCIAL_COOKIE_MAX_AGE,
      secure: cookieSecure(),
    },
  );
  return out;
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../../lib/bff';

const REFERRAL_COOKIE = 'nhonga_ref';

// Verify an OTP. On success the API returns an opaque session token, which we
// store in an httpOnly cookie so it is never exposed to page JavaScript.
async function handlePOST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  // Carry a captured invite code into the signup so the referrer is credited.
  const referralCode = (await cookies()).get(REFERRAL_COOKIE)?.value;
  const res = await apiFetch(`/auth/otp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept-language': 'pt' },
    body: JSON.stringify(referralCode ? { ...body, referralCode } : body),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as {
    sessionToken?: string;
    user?: unknown;
    message?: string;
    detail?: string;
  };
  if (!res.ok || !data.sessionToken) {
    return NextResponse.json(
      { message: data.detail ?? data.message ?? 'Verification failed' },
      { status: res.status === 200 ? 400 : res.status },
    );
  }
  const out = NextResponse.json({ user: data.user });
  out.cookies.set(SESSION_COOKIE, data.sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 3600,
    // Secure in production builds. Staging without a domain is plain HTTP, where
    // browsers drop Secure cookies, so it opts out explicitly; never set this
    // where real users sign in.
    secure: process.env.NODE_ENV === 'production' && process.env.SESSION_COOKIE_INSECURE !== '1',
  });
  // The invite code has been consumed (or ignored) — clear it either way.
  if (referralCode) out.cookies.set(REFERRAL_COOKIE, '', { path: '/', maxAge: 0 });
  return out;
}

export const POST = withApi(handlePOST);

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiFetch, readJson, withApi } from '../../../../lib/bff';
import { sessionCookie } from '../../../../lib/session-cookie';

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
  const data = (await readJson(res).catch(() => ({}))) as {
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
  out.cookies.set(sessionCookie(data.sessionToken));
  // The invite code has been consumed (or ignored) — clear it either way.
  if (referralCode) out.cookies.set(REFERRAL_COOKIE, '', { path: '/', maxAge: 0 });
  return out;
}

export const POST = withApi(handlePOST);

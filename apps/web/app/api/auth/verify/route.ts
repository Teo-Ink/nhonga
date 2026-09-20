import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const SESSION_COOKIE = 'nhonga_session';

// Verify an OTP. On success the API returns an opaque session token, which we
// store in an httpOnly cookie so it is never exposed to page JavaScript.
export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${API_URL}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept-language': 'pt' },
    body: JSON.stringify(body),
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
    secure: process.env.NODE_ENV === 'production',
  });
  return out;
}

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../../lib/bff';

// Revoke the session server-side and clear the cookie.
async function handlePOST(): Promise<Response> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await apiFetch(`/auth/logout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).catch(() => {});
  }
  const out = NextResponse.json({ ok: true });
  out.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return out;
}

export const POST = withApi(handlePOST);

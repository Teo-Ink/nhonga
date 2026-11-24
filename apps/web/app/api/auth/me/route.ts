import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, apiFetch, readJson, withApi } from '../../../../lib/bff';

// Current user, or { user: null } when not signed in. Never errors, so the
// client can treat a signed-out visitor as an ordinary state.
async function handleGET(): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ user: null });
  const res = await apiFetch(`/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return NextResponse.json({ user: null });
  const user = await readJson(res);
  return NextResponse.json({ user });
}

export const GET = withApi(handleGET, () => Response.json({ user: null }));

// Delete the signed-in account (P0-06), then clear the session cookie.
async function handleDELETE(): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Inicie sessão.' }, { status: 401 });
  const res = await apiFetch(`/auth/me`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  }
  const out = NextResponse.json({ ok: true });
  out.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return out;
}

export const DELETE = withApi(handleDELETE);

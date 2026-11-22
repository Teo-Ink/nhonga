import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../../lib/bff';

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
  const user = await res.json();
  return NextResponse.json({ user });
}

export const GET = withApi(handleGET, () => Response.json({ user: null }));

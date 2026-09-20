import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const SESSION_COOKIE = 'nhonga_session';

// Current user, or { user: null } when not signed in. Never errors, so the
// client can treat a signed-out visitor as an ordinary state.
export async function GET(): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ user: null });
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return NextResponse.json({ user: null });
  const user = await res.json();
  return NextResponse.json({ user });
}

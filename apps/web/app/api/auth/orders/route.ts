import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const SESSION_COOKIE = 'nhonga_session';

// The signed-in user's orders, or an empty list when signed out.
export async function GET(): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ orders: [] });
  const res = await fetch(`${API_URL}/auth/orders`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return NextResponse.json({ orders: [] });
  return NextResponse.json(await res.json());
}

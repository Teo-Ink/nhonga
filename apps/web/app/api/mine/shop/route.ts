// BFF: the signed-in seller's shop (or null), forwarded with the session token.
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const SESSION_COOKIE = 'nhonga_session';

export async function GET(): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return Response.json(null);
  const res = await fetch(`${API_URL}/catalog/mine/shop`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return Response.json(null);
  const data = await res.json();
  return Response.json(data);
}

// BFF: the signed-in seller's own listings, forwarded with the session token.
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const SESSION_COOKIE = 'nhonga_session';

export async function GET(): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return Response.json({ shop: null, items: [] });
  const res = await fetch(`${API_URL}/catalog/mine/products`, {
    headers: { authorization: `Bearer ${token}`, 'accept-language': 'pt' },
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

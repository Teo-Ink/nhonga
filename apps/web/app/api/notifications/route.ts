// BFF: the seller's notifications, forwarded with the session token.
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../lib/bff';

async function handleGET(): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return Response.json({ items: [], unread: 0 });
  const res = await apiFetch(`/notifications`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = withApi(handleGET);

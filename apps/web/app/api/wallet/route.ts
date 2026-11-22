// BFF: the signed-in seller's wallet (balance + points + history).
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../lib/bff';

async function handleGET(): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return Response.json({
      hasShop: false,
      shopName: null,
      balanceCents: 0,
      points: 0,
      transactions: [],
    });
  }
  const res = await apiFetch(`/wallet`, {
    headers: { authorization: `Bearer ${token}`, 'accept-language': 'pt' },
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = withApi(handleGET);

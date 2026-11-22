// BFF: subscribe / renew "Loja Pro" for the signed-in seller (demo charge).
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../../lib/bff';

async function handlePOST(): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return Response.json({ detail: 'Inicie sessão.' }, { status: 401 });
  const res = await apiFetch(`/wallet/pro`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'accept-language': 'pt' },
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const POST = withApi(handlePOST);

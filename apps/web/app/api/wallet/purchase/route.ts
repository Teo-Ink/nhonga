// BFF: buy a prepaid wallet package for the signed-in seller (demo credit).
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, idempotency, withApi } from '../../../../lib/bff';

async function handlePOST(req: Request): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return Response.json({ detail: 'Inicie sessão.' }, { status: 401 });
  const body = await req.text();
  const res = await apiFetch(`/wallet/purchase`, {
    method: 'POST',
    headers: {
      ...idempotency(req),
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'accept-language': 'pt',
    },
    body,
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const POST = withApi(handlePOST);

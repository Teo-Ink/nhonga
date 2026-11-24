// BFF: remove the applied banner from a listing.
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../../lib/bff';

async function handlePOST(req: Request): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return Response.json({ message: 'Inicie sessão.' }, { status: 401 });
  const body = await req.text();
  const res = await apiFetch(`/banners/unapply`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
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

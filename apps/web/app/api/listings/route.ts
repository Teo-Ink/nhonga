// BFF: the full listings feed, forwarded to the private catalogue API. Used by
// the favourites page, which filters it against the viewer's local list.
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../lib/bff';

async function handleGET(): Promise<Response> {
  const res = await apiFetch(`/catalog/products?limit=48`, {
    headers: { 'accept-language': 'pt' },
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

// Create a listing (real "Publicar"), forwarded to the catalogue API. Forwards
// the session cookie as a bearer token so the listing attaches to the signed-in
// seller's own shop (or the community shop when signed out).
async function handlePOST(req: Request): Promise<Response> {
  const body = await req.text();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await apiFetch(`/catalog/products`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept-language': 'pt',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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

export const GET = withApi(handleGET);
export const POST = withApi(handlePOST);

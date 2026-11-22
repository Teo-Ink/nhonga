// BFF: edit (PATCH) or remove (DELETE) one of the seller's listings, forwarding
// the session cookie as a bearer token so the API can check ownership.
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../../lib/bff';

async function auth(): Promise<Record<string, string>> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function handlePATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const body = await req.text();
  const res = await apiFetch(`/catalog/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'accept-language': 'pt', ...(await auth()) },
    body,
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

async function handleDELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const res = await apiFetch(`/catalog/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...(await auth()) },
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const PATCH = withApi(handlePATCH);
export const DELETE = withApi(handleDELETE);

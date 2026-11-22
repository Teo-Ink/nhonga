// BFF: change a listing's status (active/sold/archived), forwarding the session.
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../../../lib/bff';

async function handlePATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const body = await req.text();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await apiFetch(`/catalog/products/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
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

export const PATCH = withApi(handlePATCH);

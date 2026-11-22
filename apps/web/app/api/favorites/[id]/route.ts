// BFF: remove a server favourite.
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../../lib/bff';

async function handleDELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await apiFetch(`/favorites/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}

export const DELETE = withApi(handleDELETE);

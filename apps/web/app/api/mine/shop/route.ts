// BFF: the signed-in seller's shop (or null), forwarded with the session token.
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../../lib/bff';

async function handleGET(): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return Response.json(null);
  const res = await apiFetch(`/catalog/mine/shop`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return Response.json(null);
  const data = await res.json();
  return Response.json(data);
}

export const GET = withApi(handleGET, () => Response.json(null));

// BFF: the signed-in seller's shop (or null), forwarded with the session token.
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, readJson, withApi } from '../../../../lib/bff';

async function handleGET(): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return Response.json(null);
  const res = await apiFetch(`/catalog/mine/shop`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return Response.json(null);
  // The API answers 200 with an empty body when the user has no shop; that
  // made res.json() throw and caused the 500 seen on staging.
  return Response.json(await readJson(res));
}

export const GET = withApi(handleGET, () => Response.json(null));

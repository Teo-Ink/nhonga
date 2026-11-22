// BFF: get/set the seller's notification preferences.
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../../lib/bff';

async function authHeader(): Promise<Record<string, string>> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function handleGET(): Promise<Response> {
  const res = await apiFetch(`/notifications/prefs`, {
    headers: await authHeader(),
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

async function handlePUT(req: Request): Promise<Response> {
  const body = await req.text();
  const res = await apiFetch(`/notifications/prefs`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(await authHeader()) },
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
export const PUT = withApi(handlePUT);

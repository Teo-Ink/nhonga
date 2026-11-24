// BFF: create a saved search (with SMS alert), forwarded to the API.
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../lib/bff';

async function auth(): Promise<Record<string, string>> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function handlePOST(req: Request): Promise<Response> {
  const body = await req.text();
  const res = await apiFetch(`/saved-searches`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await auth()) },
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

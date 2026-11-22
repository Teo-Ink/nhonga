// BFF: list conversations (GET) / start a conversation (POST).
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../lib/bff';

async function auth(): Promise<Record<string, string>> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function handleGET(): Promise<Response> {
  const res = await apiFetch(`/conversations`, {
    headers: await auth(),
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

async function handlePOST(req: Request): Promise<Response> {
  const body = await req.text();
  const res = await apiFetch(`/conversations`, {
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

export const GET = withApi(handleGET);
export const POST = withApi(handlePOST);

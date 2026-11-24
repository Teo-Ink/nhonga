// BFF: run a saved-search alert check (mock SMS), forwarded to the API.
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../../lib/bff';

async function auth(): Promise<Record<string, string>> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function handlePOST(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get('id');
  const qs = id ? `?id=${encodeURIComponent(id)}` : '';
  const res = await apiFetch(`/saved-searches/run${qs}`, {
    method: 'POST',
    headers: await auth(),
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const POST = withApi(handlePOST);

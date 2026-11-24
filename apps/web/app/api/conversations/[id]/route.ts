// BFF: fetch one conversation thread (and mark it read for the viewer).
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../../lib/bff';

async function handleGET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await apiFetch(`/conversations/${encodeURIComponent(id)}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = withApi(handleGET);

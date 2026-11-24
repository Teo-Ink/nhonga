// BFF: search autocomplete suggestions, forwarded from the catalogue API.
import { apiFetch, withApi } from '../../../lib/bff';

async function handleGET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  if (q.trim().length < 2) return Response.json([]);
  const res = await apiFetch(`/catalog/suggest?q=${encodeURIComponent(q)}`, {
    headers: { 'accept-language': 'pt' },
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = withApi(handleGET);

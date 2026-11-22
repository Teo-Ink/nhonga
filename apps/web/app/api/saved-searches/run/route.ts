// BFF: run a saved-search alert check (mock SMS), forwarded to the API.
import { apiFetch, withApi } from '../../../../lib/bff';

async function handlePOST(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get('id');
  const qs = id ? `?id=${encodeURIComponent(id)}` : '';
  const res = await apiFetch(`/saved-searches/run${qs}`, {
    method: 'POST',
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const POST = withApi(handlePOST);

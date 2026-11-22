// BFF: create a saved search (with SMS alert), forwarded to the API.
import { apiFetch, withApi } from '../../../lib/bff';

async function handlePOST(req: Request): Promise<Response> {
  const body = await req.text();
  const res = await apiFetch(`/saved-searches`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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

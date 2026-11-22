// BFF: buy a promotion for a listing, forwarded to the API.
import { apiFetch, withApi } from '../../../lib/bff';

async function handlePOST(req: Request): Promise<Response> {
  const body = await req.text();
  const res = await apiFetch(`/promotions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept-language': 'pt' },
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

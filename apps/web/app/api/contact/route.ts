// BFF: the seller's numbers, on request (PRIV-01). The public pages carry only
// which channels exist; the digits come from here when the visitor taps
// WhatsApp or "Ver número". The API limits how many a visitor may ask for.
import { apiFetch, withApi } from '../../../lib/bff';

async function handlePOST(req: Request): Promise<Response> {
  const res = await apiFetch(`/catalog/contacts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: await req.text(),
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const POST = withApi(handlePOST);

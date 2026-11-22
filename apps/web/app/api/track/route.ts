// BFF: records a listing engagement event (contact / share / view). Fire-and-
// forget from the client; keeps API_URL server-side.
import { apiFetch, withApi } from '../../../lib/bff';
const TYPES = ['contact', 'share', 'view'];

async function handlePOST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { slug?: string; type?: string };
  if (!body.slug || !body.type || !TYPES.includes(body.type)) {
    return new Response(null, { status: 400 });
  }
  await apiFetch(`/catalog/products/${encodeURIComponent(body.slug)}/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: body.type }),
    cache: 'no-store',
  }).catch(() => {});
  return new Response(null, { status: 204 });
}

export const POST = withApi(handlePOST);

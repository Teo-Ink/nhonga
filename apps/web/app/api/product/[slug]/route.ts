// BFF: a product's full detail (for the edit form to prefill), from the API.
import { apiFetch, withApi } from '../../../../lib/bff';

async function handleGET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const res = await apiFetch(`/catalog/products/${encodeURIComponent(slug)}`, {
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

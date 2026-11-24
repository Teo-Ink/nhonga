// BFF: provinces for the location search picker (static, cacheable).
import { apiFetch, withApi } from '../../../lib/bff';

async function handleGET(): Promise<Response> {
  const res = await apiFetch(`/catalog/provinces`, {
    headers: { 'accept-language': 'pt' },
    next: { revalidate: 3600 },
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = withApi(handleGET);

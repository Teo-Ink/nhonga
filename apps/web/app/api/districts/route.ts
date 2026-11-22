// BFF: districts for the location drill-down (static, cacheable).
import { apiFetch, withApi } from '../../../lib/bff';

async function handleGET(): Promise<Response> {
  const res = await apiFetch(`/catalog/districts`, {
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

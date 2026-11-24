// BFF: the admin-set promotion plans, forwarded from the API.
import { apiFetch, withApi } from '../../../../lib/bff';

async function handleGET(): Promise<Response> {
  const res = await apiFetch(`/promotions/plans`, {
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

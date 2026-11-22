// BFF: promotion plans a seller can buy with wallet balance.
import { apiFetch, withApi } from '../../../../lib/bff';

async function handleGET(): Promise<Response> {
  const res = await apiFetch(`/wallet/plans`, {
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

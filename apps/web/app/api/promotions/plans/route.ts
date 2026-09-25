// BFF: the admin-set promotion plans, forwarded from the API.
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function GET(): Promise<Response> {
  const res = await fetch(`${API_URL}/promotions/plans`, {
    headers: { 'accept-language': 'pt' },
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

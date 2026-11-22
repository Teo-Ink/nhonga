// BFF: subscribe a shop to Loja Pro, forwarded to the API.
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  const res = await fetch(`${API_URL}/subscriptions`, {
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

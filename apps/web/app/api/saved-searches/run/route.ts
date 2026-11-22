// BFF: run a saved-search alert check (mock SMS), forwarded to the API.
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function POST(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get('id');
  const qs = id ? `?id=${encodeURIComponent(id)}` : '';
  const res = await fetch(`${API_URL}/saved-searches/run${qs}`, {
    method: 'POST',
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

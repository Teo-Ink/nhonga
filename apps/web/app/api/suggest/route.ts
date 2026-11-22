// BFF: search autocomplete suggestions, forwarded from the catalogue API.
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  if (q.trim().length < 2) return Response.json([]);
  const res = await fetch(`${API_URL}/catalog/suggest?q=${encodeURIComponent(q)}`, {
    headers: { 'accept-language': 'pt' },
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

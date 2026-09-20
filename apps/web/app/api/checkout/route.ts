// BFF: the browser posts here (same origin); this server route forwards to the
// private API. Keeps API_URL server-side and works unchanged in production.
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const res = await fetch(`${API_URL}/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept-language': 'pt' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

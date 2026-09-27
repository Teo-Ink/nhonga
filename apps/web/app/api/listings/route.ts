// BFF: the full listings feed, forwarded to the private catalogue API. Used by
// the favourites page, which filters it against the viewer's local list.
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function GET(): Promise<Response> {
  const res = await fetch(`${API_URL}/catalog/products?limit=48`, {
    headers: { 'accept-language': 'pt' },
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

// Create a listing (real "Publicar"), forwarded to the catalogue API.
export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  const res = await fetch(`${API_URL}/catalog/products`, {
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

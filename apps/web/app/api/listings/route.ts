// BFF: the full listings feed, forwarded to the private catalogue API. Used by
// the favourites page, which filters it against the viewer's local list.
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const SESSION_COOKIE = 'nhonga_session';

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

// Create a listing (real "Publicar"), forwarded to the catalogue API. Forwards
// the session cookie as a bearer token so the listing attaches to the signed-in
// seller's own shop (or the community shop when signed out).
export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await fetch(`${API_URL}/catalog/products`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept-language': 'pt',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body,
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

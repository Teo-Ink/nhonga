// BFF: records a listing engagement event (contact / share / view). Fire-and-
// forget from the client; keeps API_URL server-side.
const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const TYPES = ['contact', 'share', 'view'];

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { slug?: string; type?: string };
  if (!body.slug || !body.type || !TYPES.includes(body.type)) {
    return new Response(null, { status: 400 });
  }
  await fetch(`${API_URL}/catalog/products/${encodeURIComponent(body.slug)}/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: body.type }),
    cache: 'no-store',
  }).catch(() => {});
  return new Response(null, { status: 204 });
}

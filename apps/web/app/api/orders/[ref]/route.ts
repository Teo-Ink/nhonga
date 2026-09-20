// BFF: read a placed order by its number, forwarding to the private API.
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ref: string }> },
): Promise<Response> {
  const { ref } = await params;
  const res = await fetch(`${API_URL}/checkout/orders/${encodeURIComponent(ref)}`, {
    headers: { 'accept-language': 'pt' },
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

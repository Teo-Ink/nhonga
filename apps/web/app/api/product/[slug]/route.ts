// BFF: a product's full detail (for the edit form to prefill), from the API.
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const res = await fetch(`${API_URL}/catalog/products/${encodeURIComponent(slug)}`, {
    headers: { 'accept-language': 'pt' },
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

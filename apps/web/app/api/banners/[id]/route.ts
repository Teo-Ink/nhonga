// BFF: serve a banner's SVG from the API (public, immutable). Referenced as an
// <img> source on the listing, cards and storefront. The id may carry a ".svg"
// suffix so the URL reads as an image.
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const clean = id.replace(/\.svg$/i, '');
  const res = await fetch(`${API_URL}/banners/${encodeURIComponent(clean)}.svg`, {
    cache: 'no-store',
  });
  if (!res.ok) return new Response('Not found', { status: res.status });
  const buf = await res.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'image/svg+xml',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

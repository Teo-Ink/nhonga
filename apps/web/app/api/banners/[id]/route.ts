// BFF: serve a banner's SVG or PNG from the API (public, immutable). Referenced
// as an <img> source on the listing/cards/storefront (.svg), and as the og:image
// + download (.png). The id carries the format suffix so the URL reads as an
// image.
import { apiFetch, withApi } from '../../../../lib/bff';

async function handleGET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const isPng = /\.png$/i.test(id);
  const clean = id.replace(/\.(svg|png)$/i, '');
  const ext = isPng ? 'png' : 'svg';
  const res = await apiFetch(`/banners/${encodeURIComponent(clean)}.${ext}`, {
    cache: 'no-store',
  });
  if (!res.ok) return new Response('Not found', { status: res.status });
  const buf = await res.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      'content-type': res.headers.get('content-type') ?? (isPng ? 'image/png' : 'image/svg+xml'),
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

export const GET = withApi(handleGET);

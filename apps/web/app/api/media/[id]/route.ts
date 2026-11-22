// BFF: serve an uploaded listing photo from the API's media store.
import { apiFetch, withApi } from '../../../../lib/bff';

async function handleGET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const res = await apiFetch(`/media/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) return new Response('Not found', { status: res.status });
  const buf = await res.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

export const GET = withApi(handleGET);

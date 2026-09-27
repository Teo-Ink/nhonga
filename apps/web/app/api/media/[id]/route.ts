// BFF: serve an uploaded listing photo from the API's media store.
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const res = await fetch(`${API_URL}/media/${encodeURIComponent(id)}`, { cache: 'no-store' });
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

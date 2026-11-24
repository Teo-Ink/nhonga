// BFF: serve an uploaded listing photo.
//
// With photos in S3 behind a CDN (P1-03), the API answers 302 to the CDN. The
// browser is sent there directly when the CDN host is allowed by the CSP
// (IMAGE_HOSTS); otherwise this route fetches the photo and serves it, so a
// missing setting slows photos down instead of breaking them.
import { apiFetch, withApi } from '../../../../lib/bff';

const allowed = new Set(
  (process.env.IMAGE_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean),
);

async function handleGET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const res = await apiFetch(`/media/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    redirect: 'manual',
  });
  if (res.status === 301 || res.status === 302) {
    const target = res.headers.get('location') ?? '';
    let host = '';
    try {
      host = new URL(target).host;
    } catch {
      return new Response('Not found', { status: 404 });
    }
    if (allowed.has(host)) {
      return new Response(null, {
        status: 302,
        headers: { location: target, 'cache-control': 'public, max-age=86400' },
      });
    }
    const cdn = await fetch(target, { signal: AbortSignal.timeout(10_000) });
    if (!cdn.ok) return new Response('Not found', { status: 404 });
    return photo(await cdn.arrayBuffer(), cdn.headers.get('content-type'));
  }
  if (!res.ok) return new Response('Not found', { status: res.status });
  return photo(await res.arrayBuffer(), res.headers.get('content-type'));
}

function photo(buf: ArrayBuffer, type: string | null): Response {
  return new Response(buf, {
    status: 200,
    headers: {
      'content-type': type ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

export const GET = withApi(handleGET);

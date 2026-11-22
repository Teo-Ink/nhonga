import { NextResponse } from 'next/server';
import { apiFetch, readJson, withApi } from '../../../lib/bff';

// Report a listing (trust & safety). Forwards to the catalogue reports endpoint.
async function handlePOST(req: Request): Promise<Response> {
  let body: { slug?: unknown; reason?: unknown; note?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const slug = typeof body.slug === 'string' ? body.slug : '';
  if (slug === '') {
    return NextResponse.json({ message: 'slug required' }, { status: 400 });
  }
  const res = await apiFetch(`/catalog/products/${encodeURIComponent(slug)}/reports`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason: body.reason, note: body.note }),
    cache: 'no-store',
  });
  const data = await readJson(res).catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export const POST = withApi(handlePOST);

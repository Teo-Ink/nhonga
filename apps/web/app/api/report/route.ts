import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

// Report a listing (trust & safety). Forwards to the catalogue reports endpoint.
export async function POST(req: Request): Promise<Response> {
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
  const res = await fetch(`${API_URL}/catalog/products/${encodeURIComponent(slug)}/reports`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason: body.reason, note: body.note }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

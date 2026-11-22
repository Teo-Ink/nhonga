import { NextResponse } from 'next/server';
import { apiFetch, withApi } from '../../../lib/bff';

// Self-serve promo booking: forwards the campaign to the API (book → mock pay →
// activate). Path is /api/spot (not /api/ads) so ad blockers don't block it.
async function handlePOST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const res = await apiFetch(`/ads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export const POST = withApi(handlePOST);

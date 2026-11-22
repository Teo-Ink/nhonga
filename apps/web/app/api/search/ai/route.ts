import { NextResponse } from 'next/server';
import { apiFetch, withApi } from '../../../../lib/bff';

// AI search: forwards a spoken phrase or a photo to the API's search-query
// drafter, which returns { query, category }. Keeps API_URL server-side; bodies
// may carry a base64 image.
export const maxDuration = 30;

async function handlePOST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const res = await apiFetch(`/assistant/search-query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export const POST = withApi(handlePOST);

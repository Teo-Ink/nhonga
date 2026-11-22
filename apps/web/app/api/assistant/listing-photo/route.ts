import { NextResponse } from 'next/server';
import { apiFetch, readJson, withApi } from '../../../../lib/bff';

// AI-assisted posting from a photo (vision): forwards the image to the API's
// photo drafter. Keeps API_URL server-side. Bodies carry a base64 image, so the
// route must accept a larger payload than the default.
export const maxDuration = 30;

async function handlePOST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const res = await apiFetch(`/assistant/listing-photo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await readJson(res).catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export const POST = withApi(handlePOST);

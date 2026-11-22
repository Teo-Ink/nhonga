import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

// AI-assisted posting from a photo (vision): forwards the image to the API's
// photo drafter. Keeps API_URL server-side. Bodies carry a base64 image, so the
// route must accept a larger payload than the default.
export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const res = await fetch(`${API_URL}/assistant/listing-photo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

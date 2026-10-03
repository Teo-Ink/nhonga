import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

// AI search: forwards a spoken phrase or a photo to the API's search-query
// drafter, which returns { query, category }. Keeps API_URL server-side; bodies
// may carry a base64 image.
export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const res = await fetch(`${API_URL}/assistant/search-query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../../../lib/bff';

// Post a seller review. Forwards the httpOnly session cookie to the API as a
// Bearer token, so the API identifies the reviewer; 401 when signed out.
async function handlePOST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: 'Inicie sessão para avaliar.' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const res = await apiFetch(`/vendors/${encodeURIComponent(id)}/reviews`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export const POST = withApi(handlePOST);

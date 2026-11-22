// BFF for hosted checkout: forwards to the API's /checkout endpoints with the
// session token from the httpOnly cookie, so the browser never holds it.
//   GET  /api/checkout/methods       → wallets available
//   POST /api/checkout/topup         → { id, checkoutUrl, … } then redirect
//   GET  /api/checkout/{id}          → status (refreshed from the gateway)
//   POST /api/checkout/mock/{id}     → dev simulator approve/decline
// Gateway webhooks go straight to the API, not through here.
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, idempotency, withApi } from '../../../../lib/bff';

const SAFE = /^[A-Za-z0-9-]+$/;

async function forward(req: Request, path: string[], method: 'GET' | 'POST'): Promise<Response> {
  if (
    path.length === 0 ||
    path.length > 2 ||
    path[0] === 'webhooks' ||
    !path.every((p) => SAFE.test(p))
  ) {
    return Response.json({ detail: 'Not found' }, { status: 404 });
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const headers: Record<string, string> = { 'accept-language': 'pt' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (method === 'POST') {
    headers['content-type'] = 'application/json';
    Object.assign(headers, idempotency(req));
  }
  const res = await apiFetch(`/checkout/${path.join('/')}`, {
    method,
    headers,
    ...(method === 'POST' ? { body: await req.text() } : {}),
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

async function handleGET(req: Request, ctx: Ctx): Promise<Response> {
  return forward(req, (await ctx.params).path, 'GET');
}

async function handlePOST(req: Request, ctx: Ctx): Promise<Response> {
  return forward(req, (await ctx.params).path, 'POST');
}

export const GET = withApi(handleGET);
export const POST = withApi(handlePOST);

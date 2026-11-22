// BFF: block / unblock the other side of a conversation (P0-18).
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../../../lib/bff';

type Ctx = { params: Promise<{ id: string }> };

function forward(method: 'POST' | 'DELETE') {
  return async (_req: Request, { params }: Ctx): Promise<Response> => {
    const { id } = await params;
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const res = await apiFetch(`/conversations/${encodeURIComponent(id)}/block`, {
      method,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  };
}

export const POST = withApi(forward('POST'));
export const DELETE = withApi(forward('DELETE'));

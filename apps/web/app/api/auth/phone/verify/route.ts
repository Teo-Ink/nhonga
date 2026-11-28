// Confirm a phone number on an account that has none (AUTH-10), step "verify".
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, readJson, withApi } from '../../../../../lib/bff';

async function handlePOST(req: Request): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Inicie sessão.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const res = await apiFetch('/auth/phone/verify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept-language': 'pt',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = (await readJson<Record<string, unknown>>(res)) ?? {};
  if (!res.ok) {
    return NextResponse.json(
      { message: data['detail'] ?? data['message'] ?? 'Não foi possível confirmar o número.' },
      { status: res.status },
    );
  }
  return NextResponse.json(data);
}

export const POST = withApi(handlePOST);

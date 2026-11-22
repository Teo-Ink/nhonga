import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, apiFetch, withApi } from '../../../../../lib/bff';

// "Descarregar os meus dados" (P0-06): the API's export, served as a file.
async function handleGET(): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Inicie sessão.' }, { status: 401 });
  const res = await apiFetch(`/auth/me/export`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return new Response(await res.text(), { status: res.status });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(await res.text(), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="nhonga-os-meus-dados-${day}.json"`,
      'cache-control': 'no-store',
    },
  });
}

export const GET = withApi(handleGET);

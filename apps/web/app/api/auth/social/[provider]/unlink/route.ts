// Detach Google/Facebook from the signed-in account.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, apiFetch, readJson, withApi } from '../../../../../../lib/bff';
import { isSocialProvider } from '../../../../../../lib/social-login';

async function handlePOST(
  _req: Request,
  ctx: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider } = await ctx.params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !isSocialProvider(provider)) {
    return NextResponse.json({ message: 'Inicie sessão.' }, { status: 401 });
  }
  const res = await apiFetch(`/auth/social/${provider}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = (await readJson<{ detail?: string; message?: string }>(res)) ?? {};
  if (!res.ok) {
    return NextResponse.json(
      { message: data.detail ?? data.message ?? 'Não foi possível desligar.' },
      { status: res.status },
    );
  }
  return NextResponse.json({ user: data });
}

export const POST = withApi(handlePOST);

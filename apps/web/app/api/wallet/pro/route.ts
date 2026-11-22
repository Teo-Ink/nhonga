// BFF: subscribe / renew "Loja Pro" for the signed-in seller (demo charge).
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const SESSION_COOKIE = 'nhonga_session';

export async function POST(): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return Response.json({ detail: 'Inicia sessão.' }, { status: 401 });
  const res = await fetch(`${API_URL}/wallet/pro`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'accept-language': 'pt' },
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

// BFF: the signed-in user's server favourites (GET) / add a favourite (POST).
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const SESSION_COOKIE = 'nhonga_session';

async function auth(): Promise<Record<string, string>> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function GET(): Promise<Response> {
  const headers = await auth();
  if (!headers.authorization) return Response.json([]);
  const res = await fetch(`${API_URL}/favorites`, { headers, cache: 'no-store' });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  const res = await fetch(`${API_URL}/favorites`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await auth()) },
    body,
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}

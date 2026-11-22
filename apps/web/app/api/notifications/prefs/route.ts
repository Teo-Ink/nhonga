// BFF: get/set the seller's notification preferences.
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const SESSION_COOKIE = 'nhonga_session';

async function authHeader(): Promise<Record<string, string>> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function GET(): Promise<Response> {
  const res = await fetch(`${API_URL}/notifications/prefs`, {
    headers: await authHeader(),
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export async function PUT(req: Request): Promise<Response> {
  const body = await req.text();
  const res = await fetch(`${API_URL}/notifications/prefs`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(await authHeader()) },
    body,
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

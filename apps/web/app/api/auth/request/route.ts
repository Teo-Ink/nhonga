const API_URL = process.env.API_URL ?? 'http://localhost:3000';

// Request an OTP. Forwarded to the API; no session involved yet.
export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${API_URL}/auth/otp/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept-language': 'pt' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

// BFF: available prepaid wallet packages (public).
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function GET(): Promise<Response> {
  const res = await fetch(`${API_URL}/wallet/packages`, {
    headers: { 'accept-language': 'pt' },
    cache: 'no-store',
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

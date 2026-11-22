// BFF: districts for the location drill-down (static, cacheable).
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function GET(): Promise<Response> {
  const res = await fetch(`${API_URL}/catalog/districts`, {
    headers: { 'accept-language': 'pt' },
    next: { revalidate: 3600 },
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

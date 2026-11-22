// BFF: provinces for the location search picker (static, cacheable).
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function GET(): Promise<Response> {
  const res = await fetch(`${API_URL}/catalog/provinces`, {
    headers: { 'accept-language': 'pt' },
    next: { revalidate: 3600 },
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

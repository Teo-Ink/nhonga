// BFF: forwards the chat transcript to the private assistant API. Keeps API_URL
// server-side; the browser never talks to the API directly.
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  try {
    const res = await fetch(`${API_URL}/assistant/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'pt' },
      body,
      cache: 'no-store',
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ message: 'assistant unavailable' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}

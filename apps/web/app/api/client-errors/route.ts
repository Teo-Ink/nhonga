// BFF: crash reports from the browser (OPS-06), handed to the API, which
// scrubs them and forwards them to the error tracker. The page never talks to
// a third party. Always answers 202: the page can do nothing with a failure.
import { apiFetch } from '../../../lib/bff';

const MAX_BYTES = 8_000;

export async function POST(req: Request): Promise<Response> {
  try {
    const text = await req.text();
    if (text.length <= MAX_BYTES) {
      const body = JSON.parse(text) as Record<string, unknown>;
      const release = process.env.APP_VERSION;
      await apiFetch(`/client-errors`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...body,
          source: 'web',
          ...(release && release !== 'latest' ? { release } : {}),
        }),
        cache: 'no-store',
        timeoutMs: 3000,
      });
    }
  } catch {
    /* a lost crash report is not worth an error of its own */
  }
  return new Response(null, { status: 202 });
}

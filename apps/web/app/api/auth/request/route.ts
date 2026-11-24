import { clientIp, overLimit, tooMany } from '../../../../lib/rate-limit';
import { apiFetch, withApi } from '../../../../lib/bff';

// Each request sends a paid SMS: at most 20 per visitor IP per 10 minutes.
const OTP_PER_IP = 20;
const OTP_WINDOW_MS = 10 * 60_000;

// Request an OTP. Forwarded to the API; no session involved yet.
async function handlePOST(req: Request): Promise<Response> {
  const wait = overLimit(`otp:${clientIp(req)}`, OTP_PER_IP, OTP_WINDOW_MS);
  if (wait > 0) return tooMany(wait);
  const body = await req.json().catch(() => ({}));
  const res = await apiFetch(`/auth/otp/request`, {
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

export const POST = withApi(handlePOST);

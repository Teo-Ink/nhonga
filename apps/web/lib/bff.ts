// Shared plumbing for the BFF route handlers in app/api (WEB-01).
//
// Every route calls the Nhonga API server-side. Without this helper a down or
// slow API surfaced as an unhandled exception, i.e. a bare 500 with no body,
// and a hung API held the request open indefinitely. Now:
//   - every call has a timeout (longer for the AI endpoints);
//   - a network error or timeout becomes ApiUnavailableError, which withApi()
//     turns into a 503 problem+json with a Portuguese message, or into a
//     route-specific fallback (e.g. "not signed in");
//   - any other unexpected failure becomes a 502 instead of a 500.

import { forwardedFor } from './client-ip';

export const API_URL = process.env.API_URL ?? 'http://localhost:3000';
export const SESSION_COOKIE = 'nhonga_session';
/** Every call goes to the versioned API (P2-11). */
export const API_VERSION = 'v1';

const DEFAULT_TIMEOUT_MS = 10_000;
// Generative endpoints (assistant, banner studio, AI search) legitimately take
// longer than an ordinary read.
const SLOW_PREFIXES = ['/assistant', '/banners', '/search/ai'];
const SLOW_TIMEOUT_MS = 60_000;

export class ApiUnavailableError extends Error {
  constructor(
    readonly path: string,
    readonly reason: 'timeout' | 'network',
  ) {
    super(`API unavailable (${reason}) for ${path}`);
    this.name = 'ApiUnavailableError';
  }
}

export function timeoutFor(path: string): number {
  return SLOW_PREFIXES.some((p) => path.startsWith(p)) ? SLOW_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
}

export type ApiFetchInit = RequestInit & { timeoutMs?: number };

/**
 * fetch() against the API. `path` starts with "/" and is appended to API_URL.
 * Throws ApiUnavailableError on a network error or timeout; HTTP error statuses
 * are returned as normal responses for the route to forward.
 */
export async function apiFetch(
  path: string,
  init: ApiFetchInit = {},
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const { timeoutMs = timeoutFor(path), ...rest } = init;
  // Every API call carries a request id (P1-08): the API logs it on each line
  // it writes for this call, and a failure here logs the same id.
  const headers = new Headers(rest.headers);
  if (!headers.has('x-request-id')) headers.set('x-request-id', `web-${crypto.randomUUID()}`);
  // Tell the API who the visitor is, so its limits count people, not this server (PRE-02).
  if (!headers.has('x-forwarded-for')) {
    for (const [k, v] of Object.entries(await forwardedFor())) headers.set(k, v);
  }
  try {
    return await fetchImpl(`${API_URL}/${API_VERSION}${path}`, {
      ...rest,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    logJson('WARN', 'bff', `api_unreachable ${path.split('?')[0]}`, headers.get('x-request-id'));
    throw new ApiUnavailableError(path, name === 'TimeoutError' ? 'timeout' : 'network');
  }
}

/**
 * Reads a JSON body that may be empty. Nest sends no body for a handler that
 * returns null (e.g. "no shop yet"), and res.json() throws on that.
 */
export async function readJson<T = unknown>(res: Response): Promise<T | null> {
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}

export function problem(status: number, title: string, detail: string): Response {
  return new Response(JSON.stringify({ type: 'about:blank', title, status, detail }), {
    status,
    headers: { 'content-type': 'application/problem+json; charset=utf-8' },
  });
}

export function unavailable(): Response {
  return problem(
    503,
    'Serviço indisponível',
    'O serviço está temporariamente indisponível. Tente novamente dentro de instantes.',
  );
}

/**
 * Wraps a route handler so an unreachable API answers 503 (or `fallback`) and
 * any other unexpected error answers 502, never an unhandled 500.
 */
export function withApi<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
  fallback?: () => Response,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof ApiUnavailableError) {
        return fallback ? fallback() : unavailable();
      }
      logJson('ERROR', 'bff', e instanceof Error ? (e.stack ?? e.message) : String(e), null);
      return problem(
        502,
        'Erro no servidor',
        'Ocorreu um erro inesperado. Tente novamente dentro de instantes.',
      );
    }
  };
}

/** One JSON line per event, like the API (P1-08). Levels are upper case so the
 *  CloudWatch "?ERROR" metric filter matches. */
export function logJson(
  level: 'ERROR' | 'WARN' | 'INFO',
  context: string,
  msg: string,
  requestId: string | null,
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    context,
    msg,
    ...(requestId ? { requestId } : {}),
  });
  if (level === 'ERROR') console.error(line);
  else console.warn(line);
}

/** Forwards the browser's Idempotency-Key (P2-11) on money routes, so a retried
 *  or double-tapped payment is answered once by the API. */
export function idempotency(req: Request): Record<string, string> {
  const key = req.headers.get('idempotency-key');
  return key ? { 'idempotency-key': key } : {};
}

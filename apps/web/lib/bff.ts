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

export const API_URL = process.env.API_URL ?? 'http://localhost:3000';
export const SESSION_COOKIE = 'nhonga_session';

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
  try {
    return await fetchImpl(`${API_URL}${path}`, {
      ...rest,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    throw new ApiUnavailableError(path, name === 'TimeoutError' ? 'timeout' : 'network');
  }
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
        console.warn(`[bff] ${e.message}`);
        return fallback ? fallback() : unavailable();
      }
      console.error('[bff] unexpected error', e);
      return problem(
        502,
        'Erro no servidor',
        'Ocorreu um erro inesperado. Tente novamente dentro de instantes.',
      );
    }
  };
}

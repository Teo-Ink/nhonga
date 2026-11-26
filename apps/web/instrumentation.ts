// Server-side errors in pages and route handlers (P0-13), logged as one JSON
// line with the route, so the CloudWatch error alarm sees them. Next.js calls
// onRequestError for every uncaught server error.
import { API_URL, API_VERSION, ApiUnavailableError, logJson } from './lib/bff';

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routePath: string; routeType: string },
): Promise<void> {
  const id = request.headers['x-request-id'];
  logJson(
    'ERROR',
    `next:${context.routeType}`,
    `${request.method} ${context.routePath}: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
    typeof id === 'string' ? id : null,
  );
  // Also to the error tracker, through the API (OPS-06). Skipped when the
  // failure is the API itself being unreachable: it could not receive this.
  if (err instanceof ApiUnavailableError) return;
  const e = err instanceof Error ? err : new Error(String(err));
  const release = process.env.APP_VERSION;
  await fetch(`${API_URL}/${API_VERSION}/client-errors`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      source: 'web-server',
      message: `${e.name}: ${e.message}`.slice(0, 500),
      stack: e.stack?.slice(0, 4000),
      route: `${request.method} ${context.routePath}`.slice(0, 200),
      ...(release && release !== 'latest' ? { release } : {}),
    }),
    signal: AbortSignal.timeout(2000),
  }).catch(() => {});
}

// Server-side errors in pages and route handlers (P0-13), logged as one JSON
// line with the route, so the CloudWatch error alarm sees them. Next.js calls
// onRequestError for every uncaught server error.
import { logJson } from './lib/bff';

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
}

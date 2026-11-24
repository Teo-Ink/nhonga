/**
 * Error tracking (P0-13). With SENTRY_DSN set, errors go to Sentry tagged with
 * the release (APP_VERSION, the image's git SHA) and the request id; without
 * it, they are only logged. Loaded lazily so the API runs without the SDK
 * configured, and a broken reporter can never take a request down.
 */
interface Reporter {
  captureException(e: unknown, ctx?: { tags?: Record<string, string> }): void;
}

let reporter: Reporter | null = null;

export async function initErrorReporting(env = process.env): Promise<boolean> {
  // The DSN comes from a secret that starts as a placeholder; only a real
  // address turns reporting on.
  const dsn = env['SENTRY_DSN']?.trim();
  if (!dsn || !dsn.startsWith('https://')) return false;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: env['NODE_ENV'] ?? 'development',
      release: env['APP_VERSION'] ?? 'unknown',
      tracesSampleRate: 0,
      // Nothing personal by default (the SDK's defaults collect the client
      // IP, cookies and headers); scrubEvent below is the second line.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: { allow: ['user-agent', 'accept-language', 'content-type', 'x-request-id'] },
        httpBodies: [],
        urlQueryParams: false,
        genAI: { inputs: false, outputs: false },
        databaseQueryData: false,
        stackFrameVariables: false,
      },
      beforeSend: (event) => scrubEvent(event),
    });
    reporter = Sentry;
    return true;
  } catch {
    return false;
  }
}

export function reportError(
  e: unknown,
  ctx: { context?: string | undefined; requestId?: string | undefined; stack?: string | undefined },
): void {
  if (!reporter) return;
  try {
    const tags: Record<string, string> = {};
    if (ctx.context) tags['context'] = ctx.context;
    if (ctx.requestId) tags['request_id'] = ctx.requestId;
    reporter.captureException(e instanceof Error ? e : loggedError(String(e), ctx), { tags });
  } catch {
    /* never let reporting fail a request */
  }
}

/**
 * Most errors reach the logger as text (Nest passes message, stack, context).
 * Sent as a plain message they would all arrive as level "info" under one
 * title; as an Error named after their source they are real, separate issues.
 */
export function loggedError(
  message: string,
  ctx: { context?: string | undefined; stack?: string | undefined },
): Error {
  const err = new Error(message);
  err.name = ctx.context ?? 'LoggedError';
  // The original stack when Nest supplied one; otherwise no frames, so the
  // issue is not blamed on (and grouped under) the logger itself.
  err.stack = ctx.stack ?? `${err.name}: ${message}`;
  return err;
}

const KEPT_HEADERS = new Set(['user-agent', 'accept-language', 'content-type', 'x-request-id']);

/**
 * Personal data stays out of the error tracker: no client IP, cookies, request
 * body or query string, and only a few harmless headers (never the session,
 * the admin token or X-Forwarded-For).
 */
export function scrubEvent<T extends object>(input: T): T {
  const event = input as { user?: Record<string, unknown>; request?: Record<string, unknown> };
  if (event.user) {
    delete event.user['ip_address'];
    delete event.user['email'];
    delete event.user['username'];
  }
  const req = event.request;
  if (req) {
    delete req['cookies'];
    delete req['data'];
    delete req['query_string'];
    delete req['env'];
    if (typeof req['url'] === 'string') req['url'] = req['url'].split('?')[0];
    const headers = req['headers'];
    if (headers && typeof headers === 'object') {
      req['headers'] = Object.fromEntries(
        Object.entries(headers as Record<string, unknown>).filter(([k]) =>
          KEPT_HEADERS.has(k.toLowerCase()),
        ),
      );
    }
  }
  return input;
}

/** For tests. */
export function setReporter(r: Reporter | null): void {
  reporter = r;
}

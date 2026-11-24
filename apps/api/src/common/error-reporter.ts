/**
 * Error tracking (P0-13). With SENTRY_DSN set, errors go to Sentry tagged with
 * the release (APP_VERSION, the image's git SHA) and the request id; without
 * it, they are only logged. Loaded lazily so the API runs without the SDK
 * configured, and a broken reporter can never take a request down.
 */
interface Reporter {
  captureException(e: unknown, ctx?: { tags?: Record<string, string> }): void;
  captureMessage(m: string, ctx?: { tags?: Record<string, string> }): void;
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
    if (e instanceof Error) reporter.captureException(e, { tags });
    else reporter.captureMessage(String(e), { tags });
  } catch {
    /* never let reporting fail a request */
  }
}

/** For tests. */
export function setReporter(r: Reporter | null): void {
  reporter = r;
}

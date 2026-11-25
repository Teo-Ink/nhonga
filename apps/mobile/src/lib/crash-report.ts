// Crash reports from the app (OPS-06). Unhandled JavaScript errors are sent to
// the Nhonga API, which scrubs them and forwards them to the error tracker.
// No third-party SDK and no native module: this does not catch native crashes
// (those show in the Play Console / App Store Connect).

export interface CrashReport {
  source: 'mobile';
  message: string;
  stack?: string;
  route?: string;
  release?: string;
  platform?: string;
}

export interface CrashContext {
  /** e.g. "android 14". */
  platform: string;
  release: string;
  /** Current screen path, when known. */
  route?: () => string | undefined;
}

/** Reports per app start: a crash loop must not become a request loop. */
export const MAX_REPORTS_PER_START = 5;

export function buildCrashReport(error: unknown, ctx: CrashContext, fatal = false): CrashReport {
  const err = error instanceof Error ? error : null;
  const text = err ? `${err.name}: ${err.message}` : String(error);
  const report: CrashReport = {
    source: 'mobile',
    message: `${fatal ? '[fatal] ' : ''}${text}`.slice(0, 500),
    platform: ctx.platform.slice(0, 64),
    release: ctx.release.slice(0, 64),
  };
  if (err?.stack) report.stack = err.stack.slice(0, 4000);
  const route = ctx.route?.();
  // The path only: parameters after "?" can carry search terms.
  if (route) report.route = route.split('?')[0]!.slice(0, 200);
  return report;
}

type Send = (report: CrashReport) => void;

/** Each distinct error once, at most MAX_REPORTS_PER_START; never throws. */
export function createCrashReporter(ctx: CrashContext, send: Send, max = MAX_REPORTS_PER_START) {
  const seen = new Set<string>();
  return (error: unknown, fatal = false): boolean => {
    try {
      const report = buildCrashReport(error, ctx, fatal);
      if (seen.size >= max || seen.has(report.message)) return false;
      seen.add(report.message);
      send(report);
      return true;
    } catch {
      return false;
    }
  };
}

interface ErrorUtilsLike {
  getGlobalHandler(): (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void;
}

/**
 * Hooks React Native's global error handler. The previous handler still runs
 * afterwards, so the red box in development and the crash in release behave
 * exactly as before. Returns false where the hook does not exist.
 */
export function installCrashHandler(
  report: (error: unknown, fatal?: boolean) => unknown,
  errorUtils: ErrorUtilsLike | undefined = (globalThis as { ErrorUtils?: ErrorUtilsLike })
    .ErrorUtils,
): boolean {
  if (!errorUtils?.setGlobalHandler) return false;
  const previous = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error, isFatal) => {
    report(error, isFatal === true);
    previous?.(error, isFatal);
  });
  return true;
}

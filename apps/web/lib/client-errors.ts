// Crash reports from the browser (OPS-06). Unhandled errors are sent to our
// own /api/client-errors, which hands them to the API; nothing goes from the
// page to a third party. Pure helpers here, wiring in ErrorReporter.tsx.

export interface ClientErrorBody {
  source: 'web';
  message: string;
  stack?: string;
  route?: string;
  platform?: string;
}

/** Reports per page load: a render loop must not turn into a request loop. */
export const MAX_REPORTS_PER_PAGE = 5;

/** Noise that is not ours to fix: extensions, cancelled navigations, and the
 *  opaque "Script error." browsers give for other origins' scripts. */
const IGNORED = [
  /^Script error\.?$/im,
  /ResizeObserver loop/i,
  /^AbortError/m,
  /The user aborted a request/i,
  /Load failed|Failed to fetch|NetworkError/i,
  /extension:\/\//i,
];

export function isReportable(message: string, stack?: string): boolean {
  const text = `${message}\n${stack ?? ''}`;
  return message.trim().length > 0 && !IGNORED.some((re) => re.test(text));
}

export function platformFromUserAgent(ua: string): string {
  const browser =
    /Edg\/(\d+)/.exec(ua)?.[0].replace('Edg/', 'Edge ') ??
    /OPR\/(\d+)/.exec(ua)?.[0].replace('OPR/', 'Opera ') ??
    /Chrome\/(\d+)/.exec(ua)?.[0].replace('/', ' ') ??
    /Firefox\/(\d+)/.exec(ua)?.[0].replace('/', ' ') ??
    (/Version\/(\d+).*Safari/.test(ua) ? `Safari ${/Version\/(\d+)/.exec(ua)![1]}` : 'other');
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'other';
  return `${browser} / ${os}`;
}

export function buildReport(error: unknown, pathname: string, userAgent: string): ClientErrorBody {
  const err = error instanceof Error ? error : null;
  const message = (err ? `${err.name}: ${err.message}` : String(error)).slice(0, 500);
  const body: ClientErrorBody = {
    source: 'web',
    message,
    // The path only: query strings carry search terms and tokens.
    route: pathname.split('?')[0]!.slice(0, 200),
    platform: platformFromUserAgent(userAgent).slice(0, 64),
  };
  if (err?.stack) body.stack = err.stack.slice(0, 4000);
  return body;
}

/** Decides which errors of one page load are sent: each distinct message
 *  once, and never more than MAX_REPORTS_PER_PAGE. */
export function createReportGate(max = MAX_REPORTS_PER_PAGE): (body: ClientErrorBody) => boolean {
  const seen = new Set<string>();
  return (body) => {
    if (seen.size >= max || seen.has(body.message)) return false;
    if (!isReportable(body.message, body.stack)) return false;
    seen.add(body.message);
    return true;
  };
}

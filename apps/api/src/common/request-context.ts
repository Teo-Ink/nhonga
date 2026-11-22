import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * One id per request (P1-08), carried from the web BFF (x-request-id) or made
 * here, returned in the response header and written on every log line made
 * while serving the request, so one user's error can be followed from the
 * browser to the database.
 */
interface Ctx {
  readonly requestId: string;
}
const store = new AsyncLocalStorage<Ctx>();

export const REQUEST_ID_HEADER = 'x-request-id';
const VALID = /^[A-Za-z0-9._-]{8,64}$/;

export function currentRequestId(): string | undefined {
  return store.getStore()?.requestId;
}

export function acceptRequestId(incoming: unknown): string {
  return typeof incoming === 'string' && VALID.test(incoming) ? incoming : randomUUID();
}

/** Writes one access line per request; never logs query strings or bodies,
 *  which can carry phone numbers or codes. */
export function requestContextMiddleware(
  log: (entry: Record<string, unknown>) => void = (e) =>
    process.stdout.write(`${JSON.stringify(e)}\n`),
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = acceptRequestId(req.headers[REQUEST_ID_HEADER]);
    res.setHeader(REQUEST_ID_HEADER, requestId);
    const started = process.hrtime.bigint();
    const path = req.path ?? '';
    res.on('finish', () => {
      if (path === '/health' || path.startsWith('/health/')) return;
      log({
        ts: new Date().toISOString(),
        level: res.statusCode >= 500 ? 'ERROR' : 'INFO',
        context: 'http',
        msg: 'request',
        method: req.method,
        path: path.replace(/\/[0-9a-f-]{36}(?=\/|$)/gi, '/:id'),
        status: res.statusCode,
        ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
        requestId,
      });
    });
    store.run({ requestId }, () => next());
  };
}

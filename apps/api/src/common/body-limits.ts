import type { IncomingMessage, ServerResponse } from 'node:http';
import express from 'express';

// Request body limits (SEC-07). Most endpoints take small JSON; only the routes
// that carry base64 photos may be large. A single 12 MB limit for everything
// let any endpoint be used to make the server parse megabytes of JSON.
export const SMALL_JSON_LIMIT = '100kb';
export const UPLOAD_JSON_LIMIT = '12mb';

/** Routes whose body may contain photos (data URLs). */
export function isUploadRoute(method: string | undefined, path: string): boolean {
  const p = path.split('?')[0] ?? '';
  if (method === 'POST' && p === '/catalog/products') return true;
  if (method === 'PATCH' && /^\/catalog\/products\/[^/]+$/.test(p)) return true;
  if (method === 'POST' && p === '/assistant/listing-photo') return true;
  return false;
}

type RawReq = IncomingMessage & { rawBody?: Buffer };

// Keep the exact bytes, as Nest's rawBody option does, for webhook signatures.
const keepRaw = (req: RawReq, _res: ServerResponse, buf: Buffer) => {
  req.rawBody = buf;
};

/**
 * JSON body parser that picks its size limit per route. Registered before
 * Nest's own parser, which then sees the body already parsed and skips it.
 */
export function jsonBodyLimits() {
  const small = express.json({ limit: SMALL_JSON_LIMIT, verify: keepRaw });
  const large = express.json({ limit: UPLOAD_JSON_LIMIT, verify: keepRaw });
  return (req: express.Request, res: express.Response, next: express.NextFunction) =>
    (isUploadRoute(req.method, req.originalUrl ?? req.url) ? large : small)(req, res, next);
}

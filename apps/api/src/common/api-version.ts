import type { NextFunction, Request, Response } from 'express';

/**
 * API versioning (P2-11). Every route answers under /v1/… — the address
 * clients use — and, for now, also without the prefix, so payment-gateway
 * webhooks registered at the old addresses and apps already installed keep
 * working. A future /v2 gets its own controllers; /v1 then stays as it is.
 */
export const API_VERSION = 'v1';

export function apiVersionMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.url === '/v1' || req.url.startsWith('/v1/') || req.url.startsWith('/v1?')) {
      req.url = req.url.slice(3) || '/';
      res.setHeader('API-Version', API_VERSION);
    }
    next();
  };
}

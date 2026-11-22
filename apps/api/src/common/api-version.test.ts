import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { apiVersionMiddleware } from './api-version.js';

function run(url: string) {
  const req = { url } as Request;
  const headers: Record<string, string> = {};
  const res = { setHeader: (k: string, v: string) => (headers[k] = v) } as unknown as Response;
  apiVersionMiddleware()(req, res, () => undefined);
  return { url: req.url, headers };
}

describe('/v1 prefix', () => {
  it('serves /v1/... from the same routes and says which version answered', () => {
    expect(run('/v1/catalog/products?q=x')).toEqual({
      url: '/catalog/products?q=x',
      headers: { 'API-Version': 'v1' },
    });
    expect(run('/v1').url).toBe('/');
  });
  it('leaves unversioned and look-alike paths alone', () => {
    expect(run('/catalog/products').url).toBe('/catalog/products');
    expect(run('/v10/x').url).toBe('/v10/x');
  });
});

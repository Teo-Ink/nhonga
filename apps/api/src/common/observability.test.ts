import type { NextFunction, Request, Response } from 'express';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import { setReporter } from './error-reporter.js';
import { JsonLogger } from './json-logger.js';
import { acceptRequestId, currentRequestId, requestContextMiddleware } from './request-context.js';

function fakeRes() {
  const ee = new EventEmitter() as EventEmitter & {
    statusCode: number;
    headers: Record<string, string>;
    setHeader: (k: string, v: string) => void;
  };
  ee.statusCode = 200;
  ee.headers = {};
  ee.setHeader = (k, v) => {
    ee.headers[k] = v;
  };
  return ee;
}

describe('request id', () => {
  it('keeps a well-formed incoming id and replaces anything else', () => {
    expect(acceptRequestId('web-1234abcd')).toBe('web-1234abcd');
    expect(acceptRequestId('x')).toMatch(/^[0-9a-f-]{36}$/);
    expect(acceptRequestId('bad id\nINJECT')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('is visible to code serving the request, returned, and logged without the query', () => {
    const lines: Record<string, unknown>[] = [];
    const mw = requestContextMiddleware((e) => lines.push(e));
    const res = fakeRes();
    let seen: string | undefined;
    mw(
      {
        headers: { 'x-request-id': 'bff-abcdef12' },
        method: 'GET',
        path: '/catalog/products/0b3c7c1e-1111-4a5b-9c9d-123456789abc',
      } as unknown as Request,
      res as unknown as Response,
      (() => {
        seen = currentRequestId();
      }) as NextFunction,
    );
    res.statusCode = 503;
    res.emit('finish');
    expect(seen).toBe('bff-abcdef12');
    expect(res.headers['x-request-id']).toBe('bff-abcdef12');
    expect(lines[0]).toMatchObject({
      level: 'ERROR',
      path: '/catalog/products/:id',
      status: 503,
      requestId: 'bff-abcdef12',
    });
  });
});

describe('JsonLogger', () => {
  afterEach(() => setReporter(null));

  it('writes one JSON object per line, respects the level, and reports errors', () => {
    const out: string[] = [];
    const reported: unknown[] = [];
    setReporter({
      captureException: (e) => reported.push(e),
    });
    const log = new JsonLogger('warn', (l) => out.push(l));
    log.log('hidden', 'Ctx');
    log.warn('careful', 'Auth');
    log.error('ALERT payment_review intent=1', 'stack here', 'Checkout');
    expect(out).toHaveLength(2);
    expect(JSON.parse(out[0]!)).toMatchObject({ level: 'WARN', context: 'Auth', msg: 'careful' });
    expect(JSON.parse(out[1]!)).toMatchObject({
      level: 'ERROR',
      context: 'Checkout',
      stack: 'stack here',
    });
    expect(out[1]).toContain('ALERT payment_review');
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({
      name: 'Checkout',
      message: 'ALERT payment_review intent=1',
    });
  });
});

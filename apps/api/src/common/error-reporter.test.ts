import { describe, expect, it } from 'vitest';
import { afterEach } from 'vitest';
import {
  initErrorReporting,
  loggedError,
  reportError,
  scrubEvent,
  setReporter,
} from './error-reporter';

describe('initErrorReporting', () => {
  it('stays off without a DSN', async () => {
    expect(await initErrorReporting({})).toBe(false);
  });

  it('stays off while the secret still holds its placeholder', async () => {
    expect(await initErrorReporting({ SENTRY_DSN: 'definir-chave' })).toBe(false);
    expect(await initErrorReporting({ SENTRY_DSN: '   ' })).toBe(false);
  });
});

describe('reportError', () => {
  afterEach(() => setReporter(null));

  it('sends logged text as an error named after its source, not as a message', () => {
    const sent: { e: unknown; tags?: Record<string, string> | undefined }[] = [];
    setReporter({ captureException: (e, ctx) => void sent.push({ e, tags: ctx?.tags }) });
    reportError('Refund failed for charge 12', { context: 'Payments', requestId: 'r-1' });
    const err = sent[0]!.e as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('Payments');
    expect(err.message).toBe('Refund failed for charge 12');
    expect(err.stack).not.toContain('json-logger');
    expect(sent[0]!.tags).toEqual({ context: 'Payments', request_id: 'r-1' });
  });

  it('keeps the original stack when the logger was given one', () => {
    const err = loggedError('boom', {
      context: 'Catalog',
      stack: 'TypeError: boom\n    at x (a.ts:1)',
    });
    expect(err.stack).toContain('at x (a.ts:1)');
  });

  it('passes real errors through untouched', () => {
    const sent: unknown[] = [];
    setReporter({ captureException: (e) => void sent.push(e) });
    const original = new TypeError('x');
    reportError(original, {});
    expect(sent[0]).toBe(original);
  });
});

describe('scrubEvent', () => {
  it('removes the client address, cookies, body, query and sensitive headers', () => {
    const event = scrubEvent({
      user: { ip_address: '197.0.0.1', id: 'u1' },
      request: {
        url: 'http://api/v1/catalog/products?q=toyota&phone=258841234567',
        query_string: 'q=toyota',
        cookies: { nhonga_session: 's' },
        data: { phone: '+258841234567' },
        headers: {
          'User-Agent': 'curl',
          'x-admin-token': 'secret',
          authorization: 'Bearer t',
          cookie: 'a=b',
          'x-forwarded-for': '197.0.0.1',
          'x-request-id': 'r-1',
        },
      },
    });
    expect(event.user).toEqual({ id: 'u1' });
    expect(event.request).toEqual({
      url: 'http://api/v1/catalog/products',
      headers: { 'User-Agent': 'curl', 'x-request-id': 'r-1' },
    });
  });

  it('leaves events without a request alone', () => {
    expect(scrubEvent({ message: 'm' } as { user?: undefined; request?: undefined })).toEqual({
      message: 'm',
    });
  });
});

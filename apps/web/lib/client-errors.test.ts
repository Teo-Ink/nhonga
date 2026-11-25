import { describe, expect, it } from 'vitest';
import {
  buildReport,
  createReportGate,
  isReportable,
  platformFromUserAgent,
} from './client-errors';

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

describe('buildReport', () => {
  it('describes the error without the query string or the full user agent', () => {
    const body = buildReport(
      new TypeError('x is undefined'),
      '/pesquisa?q=casa+maputo',
      CHROME_ANDROID,
    );
    expect(body).toMatchObject({
      source: 'web',
      message: 'TypeError: x is undefined',
      route: '/pesquisa',
      platform: 'Chrome 131 / Android',
    });
    expect(body.stack).toContain('TypeError');
    expect(JSON.stringify(body)).not.toContain('SM-A155F');
  });

  it('accepts things that are not Error objects and caps the size', () => {
    expect(buildReport('plain text', '/', '').message).toBe('plain text');
    expect(buildReport(new Error('x'.repeat(2000)), '/', '').message).toHaveLength(500);
  });

  it('names the common browsers', () => {
    expect(platformFromUserAgent(SAFARI_IOS)).toBe('Safari 18 / iOS');
    expect(platformFromUserAgent('')).toBe('other / other');
  });
});

describe('what gets reported', () => {
  it("skips noise that is not the site's fault", () => {
    expect(isReportable('Script error.')).toBe(false);
    expect(isReportable('TypeError: Failed to fetch')).toBe(false);
    expect(isReportable('ResizeObserver loop limit exceeded')).toBe(false);
    expect(isReportable('Error: x', 'at chrome-extension://abc/content.js:1')).toBe(false);
    expect(isReportable('TypeError: x is undefined')).toBe(true);
  });

  it('sends each distinct error once and stops after five per page', () => {
    const gate = createReportGate();
    const body = (m: string) => buildReport(new Error(m), '/', '');
    expect(gate(body('a'))).toBe(true);
    expect(gate(body('a'))).toBe(false);
    for (const m of ['b', 'c', 'd', 'e']) expect(gate(body(m))).toBe(true);
    expect(gate(body('f'))).toBe(false);
  });
});

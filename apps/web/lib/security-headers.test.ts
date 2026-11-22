import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from './security-headers.mjs';

describe('Content-Security-Policy (SEC-10)', () => {
  it('runs only scripts carrying the request nonce', () => {
    const csp = contentSecurityPolicy({ nonce: 'abc123' });
    const scripts = /script-src ([^;]+)/.exec(csp)?.[1] ?? '';
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it('keeps the other locks: no framing, no plugins, own origin only', () => {
    const csp = contentSecurityPolicy({ nonce: 'n', imageHosts: ['dxyz.cloudfront.net'] });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain('img-src');
    expect(csp).toContain('https://dxyz.cloudfront.net');
  });

  it('falls back to inline scripts only without a nonce', () => {
    expect(contentSecurityPolicy({})).toContain("script-src 'self' 'unsafe-inline'");
  });
});

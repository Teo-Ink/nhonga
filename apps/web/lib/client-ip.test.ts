import { describe, expect, it } from 'vitest';
import { clientIpFromXff, trustedHops } from './client-ip';

describe('clientIpFromXff (PRE-02)', () => {
  it('takes the address our load balancer appended, not what the client sent', () => {
    expect(clientIpFromXff('1.1.1.1, 41.220.0.9')).toBe('41.220.0.9');
    expect(clientIpFromXff('41.220.0.9')).toBe('41.220.0.9');
    expect(clientIpFromXff('spoof, 2c0f:f7c0::1')).toBe('2c0f:f7c0::1');
  });
  it('counts back one more hop when a CDN sits in front', () => {
    expect(clientIpFromXff('9.9.9.9, 41.220.0.9, 130.176.0.1', 2)).toBe('41.220.0.9');
  });
  it('returns null for nothing or garbage', () => {
    expect(clientIpFromXff(null)).toBeNull();
    expect(clientIpFromXff('')).toBeNull();
    expect(clientIpFromXff('<script>')).toBeNull();
    expect(clientIpFromXff('41.220.0.9', 2)).toBeNull();
  });
  it('reads the number of trusted proxies, defaulting to one', () => {
    expect(trustedHops({})).toBe(1);
    expect(trustedHops({ TRUSTED_PROXY_HOPS: '2' })).toBe(2);
    expect(trustedHops({ TRUSTED_PROXY_HOPS: 'x' })).toBe(1);
  });
});

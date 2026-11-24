import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './catalog.service.js';

describe('page cursor', () => {
  it('round-trips and ignores anything it did not issue', () => {
    expect(decodeCursor(encodeCursor(24))).toBe(24);
    expect(decodeCursor(undefined)).toBe(0);
    expect(decodeCursor('24')).toBe(0);
    expect(decodeCursor('c1.@@@')).toBe(0);
    expect(decodeCursor(encodeCursor(999_999))).toBe(2000);
  });
});

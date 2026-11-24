import { describe, expect, it } from 'vitest';
import { isMalformedId } from './problem-details.filter.js';

describe('isMalformedId (PRE-01)', () => {
  it('recognises the Postgres error for a non-UUID id, also when wrapped', () => {
    expect(isMalformedId({ code: '22P02' })).toBe(true);
    expect(isMalformedId(new Error('Failed query', { cause: { code: '22P02' } }))).toBe(true);
  });
  it('leaves every other error alone', () => {
    expect(isMalformedId(new Error('boom'))).toBe(false);
    expect(isMalformedId({ code: '23505' })).toBe(false);
    expect(isMalformedId(null)).toBe(false);
    expect(isMalformedId('22P02')).toBe(false);
  });
});

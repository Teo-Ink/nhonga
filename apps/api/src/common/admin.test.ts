import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { assertAdmin, isAdminToken } from './admin.js';

const GOOD = 'x'.repeat(40);

describe('admin token', () => {
  afterEach(() => {
    delete process.env['ADMIN_API_TOKEN'];
  });

  it('refuses everything when no token is configured', () => {
    expect(isAdminToken(GOOD, undefined)).toBe(false);
    expect(isAdminToken('', '')).toBe(false);
  });

  it('refuses a configured token that is too short to be safe', () => {
    expect(isAdminToken('short', 'short')).toBe(false);
  });

  it('accepts only the exact token', () => {
    expect(isAdminToken(GOOD, GOOD)).toBe(true);
    expect(isAdminToken(GOOD + 'y', GOOD)).toBe(false);
    expect(isAdminToken(undefined, GOOD)).toBe(false);
  });

  it('answers 404, not 401, so the endpoint does not reveal itself', () => {
    process.env['ADMIN_API_TOKEN'] = GOOD;
    expect(() => assertAdmin('wrong')).toThrow(NotFoundException);
    expect(() => assertAdmin(GOOD)).not.toThrow();
  });
});

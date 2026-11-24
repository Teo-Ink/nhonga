import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Sql } from '../db/database.module';
import { HealthController } from './health.controller';

const TOKEN = 'a'.repeat(40);
const controller = () => new HealthController((async () => []) as unknown as Sql);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /health/admin/error-test', () => {
  it('looks like it does not exist without the admin token', () => {
    vi.stubEnv('ADMIN_API_TOKEN', TOKEN);
    expect(() => controller().errorTest(undefined)).toThrow(NotFoundException);
    expect(() => controller().errorTest('wrong')).toThrow(NotFoundException);
  });

  it('writes one error line carrying the reference it returns', () => {
    vi.stubEnv('ADMIN_API_TOKEN', TOKEN);
    const lines: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((l) => (lines.push(String(l)), true));
    vi.spyOn(process.stdout, 'write').mockImplementation((l) => (lines.push(String(l)), true));
    const { reference } = controller().errorTest(TOKEN);
    expect(reference).toMatch(/^diag-[0-9a-f]{8}$/);
    expect(lines.join('')).toContain(reference);
  });
});

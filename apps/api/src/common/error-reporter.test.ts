import { describe, expect, it } from 'vitest';
import { initErrorReporting } from './error-reporter';

describe('initErrorReporting', () => {
  it('stays off without a DSN', async () => {
    expect(await initErrorReporting({})).toBe(false);
  });

  it('stays off while the secret still holds its placeholder', async () => {
    expect(await initErrorReporting({ SENTRY_DSN: 'definir-chave' })).toBe(false);
    expect(await initErrorReporting({ SENTRY_DSN: '   ' })).toBe(false);
  });
});

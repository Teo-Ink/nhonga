import { describe, expect, it } from 'vitest';
import { validateEnv } from './config.schema.js';

const SAFE_PROD = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@db:5432/nhonga',
  SMS_MODE: 'live',
  SMS_GATEWAY_URL: 'https://sms.example.co.mz/send',
  SMS_GATEWAY_TOKEN: 'tok',
  PAYMENTS_MODE: 'live',
  CHECKOUT_MODE: 'live',
  CORS_ORIGINS: 'https://nhonga.co.mz',
  ASSISTANT_MONTHLY_TOKEN_CAP: '5000000',
};

describe('production safety', () => {
  it('boots with a complete live configuration', () => {
    const c = validateEnv(SAFE_PROD);
    expect(c.nodeEnv).toBe('production');
    expect(c.paymentsMode).toBe('live');
    // No mock secret is required in live mode, and none is shared.
    expect(c.mockCallbackSecret).not.toBe('dev-only-not-a-real-secret');
    expect(c.mockCallbackSecret.length).toBeGreaterThanOrEqual(32);
  });

  it('refuses mock SMS in production (login codes would be exposed)', () => {
    expect(() => validateEnv({ ...SAFE_PROD, SMS_MODE: 'mock' })).toThrow(/SMS_MODE/);
    const { SMS_MODE: _omit, ...noSms } = SAFE_PROD;
    void _omit;
    expect(() => validateEnv(noSms)).toThrow(/SMS_MODE/);
  });

  it('refuses live SMS without gateway credentials', () => {
    expect(() => validateEnv({ ...SAFE_PROD, SMS_GATEWAY_TOKEN: '' })).toThrow(/SMS_GATEWAY/);
  });

  it('refuses mock payments or mock checkout in production', () => {
    const { PAYMENTS_MODE: _p, ...noPay } = SAFE_PROD;
    void _p;
    expect(() => validateEnv(noPay)).toThrow(/PAYMENTS_MODE/);
    expect(() => validateEnv({ ...SAFE_PROD, CHECKOUT_MODE: 'mock' })).toThrow(/CHECKOUT_MODE/);
  });

  it('refuses production without CORS origins', () => {
    expect(() => validateEnv({ ...SAFE_PROD, CORS_ORIGINS: '' })).toThrow(/CORS_ORIGINS/);
  });

  it('refuses the demo catalogue or demo storefront in production (CONT-02)', () => {
    expect(() => validateEnv({ ...SAFE_PROD, SEED_DEMO: '1' })).toThrow(/SEED_DEMO/);
    expect(() => validateEnv({ ...SAFE_PROD, NEXT_PUBLIC_DEMO_MODE: 'true' })).toThrow(
      /NEXT_PUBLIC_DEMO_MODE/,
    );
    expect(() => validateEnv({ ...SAFE_PROD, SEED_DEMO: '0' })).not.toThrow();
  });

  it('refuses production without a monthly AI token ceiling (SEC-08)', () => {
    expect(() => validateEnv({ ...SAFE_PROD, ASSISTANT_MONTHLY_TOKEN_CAP: '0' })).toThrow(
      /ASSISTANT_MONTHLY_TOKEN_CAP/,
    );
    const { ASSISTANT_MONTHLY_TOKEN_CAP: _c, ...noCap } = SAFE_PROD;
    void _c;
    expect(() => validateEnv(noCap)).toThrow(/ASSISTANT_MONTHLY_TOKEN_CAP/);
  });

  it('lets development and staging use mocks', () => {
    expect(validateEnv({ DATABASE_URL: 'postgresql://x' }).smsMode).toBe('mock');
    expect(validateEnv({ NODE_ENV: 'staging', DATABASE_URL: 'postgresql://x' }).paymentsMode).toBe(
      'mock',
    );
  });
});

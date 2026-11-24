import { describe, expect, it } from 'vitest';
import {
  checkOtpLimits,
  DEFAULT_OTP_LIMITS,
  otpLimitsFromEnv,
  type OtpUsage,
} from './otp-limits.js';

const fresh: OtpUsage = {
  secondsSinceLast: null,
  perNumberInWindow: 0,
  perNumberToday: 0,
  globalLastHour: 0,
};
const L = DEFAULT_OTP_LIMITS;

describe('checkOtpLimits', () => {
  it('allows a first request', () => {
    expect(checkOtpLimits(fresh, L)).toBeNull();
  });

  it('enforces the resend cooldown with the remaining wait', () => {
    expect(checkOtpLimits({ ...fresh, secondsSinceLast: 15 }, L)).toEqual({
      kind: 'cooldown',
      retryAfterSeconds: 45,
    });
    expect(checkOtpLimits({ ...fresh, secondsSinceLast: 60 }, L)).toBeNull();
  });

  it('caps codes per number in the 10-minute window', () => {
    expect(checkOtpLimits({ ...fresh, secondsSinceLast: 120, perNumberInWindow: 5 }, L)).toEqual({
      kind: 'per_number_window',
    });
  });

  it('caps codes per number per day', () => {
    expect(checkOtpLimits({ ...fresh, secondsSinceLast: 9000, perNumberToday: 10 }, L)).toEqual({
      kind: 'per_number_day',
    });
  });

  it('trips the global hourly breaker before anything else', () => {
    expect(
      checkOtpLimits({ ...fresh, secondsSinceLast: 1, perNumberToday: 99, globalLastHour: 500 }, L),
    ).toEqual({ kind: 'global_hour' });
  });
});

describe('otpLimitsFromEnv', () => {
  it('reads positive integers and falls back on bad values', () => {
    expect(
      otpLimitsFromEnv({
        OTP_RESEND_COOLDOWN_SECONDS: '30',
        OTP_MAX_PER_NUMBER_WINDOW: '3',
        OTP_MAX_PER_NUMBER_DAY: 'lots',
        OTP_MAX_GLOBAL_HOUR: '-1',
      }),
    ).toEqual({
      resendCooldownSeconds: 30,
      perNumberPerWindow: 3,
      perNumberPerDay: L.perNumberPerDay,
      globalPerHour: L.globalPerHour,
    });
  });
});

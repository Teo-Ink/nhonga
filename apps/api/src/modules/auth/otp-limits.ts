/**
 * Limits on sending login codes (SEC-02). Each SMS costs money, so besides the
 * per-IP limit in the web BFF the API enforces limits that hold across every
 * instance, because they are counted in Postgres:
 *
 *  - a minimum gap between two codes for the same number (resend cooldown);
 *  - a cap per number in the code's 10-minute window and per day;
 *  - a global cap per hour across all numbers (SMS-pumping circuit breaker).
 *
 * Values come from the environment; defaults suit launch traffic.
 */
export interface OtpLimits {
  readonly resendCooldownSeconds: number;
  readonly perNumberPerWindow: number;
  readonly perNumberPerDay: number;
  readonly globalPerHour: number;
}

export const DEFAULT_OTP_LIMITS: OtpLimits = {
  resendCooldownSeconds: 60,
  perNumberPerWindow: 5,
  perNumberPerDay: 10,
  globalPerHour: 500,
};

function positiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function otpLimitsFromEnv(env: NodeJS.ProcessEnv = process.env): OtpLimits {
  return {
    resendCooldownSeconds: positiveInt(
      env['OTP_RESEND_COOLDOWN_SECONDS'],
      DEFAULT_OTP_LIMITS.resendCooldownSeconds,
    ),
    perNumberPerWindow: positiveInt(
      env['OTP_MAX_PER_NUMBER_WINDOW'],
      DEFAULT_OTP_LIMITS.perNumberPerWindow,
    ),
    perNumberPerDay: positiveInt(env['OTP_MAX_PER_NUMBER_DAY'], DEFAULT_OTP_LIMITS.perNumberPerDay),
    globalPerHour: positiveInt(env['OTP_MAX_GLOBAL_HOUR'], DEFAULT_OTP_LIMITS.globalPerHour),
  };
}

export interface OtpUsage {
  /** Seconds since the last code for this number, or null if there was none. */
  readonly secondsSinceLast: number | null;
  readonly perNumberInWindow: number;
  readonly perNumberToday: number;
  readonly globalLastHour: number;
}

export type OtpLimitBreach =
  | { readonly kind: 'cooldown'; readonly retryAfterSeconds: number }
  | { readonly kind: 'per_number_window' }
  | { readonly kind: 'per_number_day' }
  | { readonly kind: 'global_hour' };

/** Returns the first limit the next send would break, or null if it may go ahead. */
export function checkOtpLimits(usage: OtpUsage, limits: OtpLimits): OtpLimitBreach | null {
  if (usage.globalLastHour >= limits.globalPerHour) return { kind: 'global_hour' };
  if (usage.perNumberToday >= limits.perNumberPerDay) return { kind: 'per_number_day' };
  if (usage.perNumberInWindow >= limits.perNumberPerWindow) return { kind: 'per_number_window' };
  if (usage.secondsSinceLast !== null && usage.secondsSinceLast < limits.resendCooldownSeconds) {
    return {
      kind: 'cooldown',
      retryAfterSeconds: Math.ceil(limits.resendCooldownSeconds - usage.secondsSinceLast),
    };
  }
  return null;
}

export function breachMessage(b: OtpLimitBreach): string {
  switch (b.kind) {
    case 'cooldown':
      return `Aguarde ${b.retryAfterSeconds} s antes de pedir outro código.`;
    case 'per_number_window':
      return 'Pediu códigos demasiadas vezes. Tente daqui a 10 minutos.';
    case 'per_number_day':
      return 'Atingiu o limite de códigos por hoje para este número. Tente amanhã.';
    case 'global_hour':
      return 'O envio de códigos está temporariamente limitado. Tente daqui a pouco.';
  }
}

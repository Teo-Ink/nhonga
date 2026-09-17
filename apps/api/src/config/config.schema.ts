/**
 * Environment validation.
 *
 * Runs once at boot. A missing or malformed variable throws here and the
 * process exits before it can accept a single request against a half-configured
 * state - which, for a service that moves money, is the only safe failure mode.
 *
 * Written without a schema library on purpose: Zod belongs in packages/shared
 * per the stack rationale, and it is not built yet. This is a few lines of
 * explicit validation rather than a new dependency introduced unilaterally.
 */

export type NodeEnv = 'development' | 'staging' | 'production' | 'test';
export type PaymentsMode = 'mock' | 'live';

export interface AppConfig {
  readonly nodeEnv: NodeEnv;
  readonly port: number;
  readonly logLevel: string;
  readonly databaseUrl: string;
  readonly paymentsMode: PaymentsMode;
  readonly mockCallbackSecret: string;
  readonly paymentApprovalTimeoutSeconds: number;
  readonly paymentLateSweepHours: number;
}

class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function requireString(env: Record<string, string | undefined>, key: string): string {
  const v = env[key];
  if (v === undefined || v.trim() === '') {
    throw new ConfigError(`Missing required environment variable ${key}`);
  }
  return v;
}

function requireInt(
  env: Record<string, string | undefined>,
  key: string,
  fallback?: number,
): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') {
    if (fallback !== undefined) return fallback;
    throw new ConfigError(`Missing required numeric environment variable ${key}`);
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new ConfigError(
      `Environment variable ${key} must be a non-negative integer, got "${raw}"`,
    );
  }
  return n;
}

function oneOf<T extends string>(
  env: Record<string, string | undefined>,
  key: string,
  allowed: readonly T[],
  fallback?: T,
): T {
  const raw = env[key] ?? fallback;
  if (raw === undefined) throw new ConfigError(`Missing required environment variable ${key}`);
  if (!allowed.includes(raw as T)) {
    throw new ConfigError(
      `Environment variable ${key} must be one of ${allowed.join(', ')}, got "${raw}"`,
    );
  }
  return raw as T;
}

/**
 * @nestjs/config calls this with the raw process env. Returning the parsed
 * object makes it available as the validated config; throwing aborts boot.
 */
export function validateEnv(raw: Record<string, string | undefined>): AppConfig {
  const paymentsMode = oneOf(raw, 'PAYMENTS_MODE', ['mock', 'live'] as const, 'mock');

  const config: AppConfig = {
    nodeEnv: oneOf(
      raw,
      'NODE_ENV',
      ['development', 'staging', 'production', 'test'] as const,
      'development',
    ),
    port: requireInt(raw, 'PORT', 3000),
    logLevel: raw['LOG_LEVEL'] ?? 'info',
    databaseUrl: requireString(raw, 'DATABASE_URL'),
    paymentsMode,
    // In mock mode a dev-only default is fine; in live mode the callback secret
    // must be supplied explicitly - a shared default secret is not a secret.
    mockCallbackSecret:
      paymentsMode === 'live'
        ? requireString(raw, 'MOCK_CALLBACK_SECRET')
        : (raw['MOCK_CALLBACK_SECRET'] ?? 'dev-only-not-a-real-secret'),
    paymentApprovalTimeoutSeconds: requireInt(raw, 'PAYMENT_APPROVAL_TIMEOUT_SECONDS', 180),
    paymentLateSweepHours: requireInt(raw, 'PAYMENT_LATE_SWEEP_HOURS', 72),
  };

  return config;
}

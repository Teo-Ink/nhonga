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

import { randomBytes } from 'node:crypto';

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
  // AI customer-service assistant (Anthropic/Claude). Optional: without a key
  // the assistant reports itself as not configured instead of failing boot.
  readonly assistantApiKey: string | null;
  readonly assistantModel: string;
  /** Per-client chat requests allowed per minute. */
  readonly assistantRatePerMin: number;
  /** Monthly token budget; 0 disables the cap. */
  readonly assistantMonthlyTokenCap: number;
  // AI Banner Studio.
  /** Free banner generations per seller per calendar month. */
  readonly bannerFreeQuota: number;
  /** Loyalty points charged per generation once the free quota is spent. */
  readonly bannerPointCost: number;
  /** fal.ai key for FLUX-schnell AI banner backgrounds. Optional: without it the
   *  studio simply offers photo backgrounds only. */
  readonly falApiKey: string | null;
  /** fal.ai model id for background generation. */
  readonly falModel: string;
  /**
   * Browser origins allowed to call the API cross-origin (CORS). The web app
   * talks to the API server-side through its BFF, and native mobile fetches are
   * not subject to CORS, so this is only needed for browser clients like the
   * Expo web preview. Empty disables CORS; in development any localhost origin
   * is reflected automatically regardless of this list.
   */
  readonly corsOrigins: readonly string[];

  // ── Outbound delivery (SMS + push) ──────────────────────────────
  /** 'mock' (log only, default) or 'live' (post to the SMS gateway). */
  readonly smsMode: 'mock' | 'live';
  /** JSON HTTP SMS gateway endpoint; required for live SMS. */
  readonly smsGatewayUrl: string | null;
  readonly smsGatewayToken: string | null;
  /** Optional alphanumeric sender ID shown on the SMS. */
  readonly smsSenderId: string | null;
  /** 'live' (real Expo push, default — free, no creds) or 'mock' (log only). */
  readonly pushMode: 'mock' | 'live';
  /** Optional Expo access token for push sender verification. */
  readonly expoAccessToken: string | null;
  /** How often the saved-search alert sweep runs; 0 disables it. */
  readonly alertsSweepMinutes: number;
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
    // Only the mock wallet uses this. In live mode no mock callbacks exist, so
    // an unguessable per-boot value is used if none is set.
    mockCallbackSecret:
      raw['MOCK_CALLBACK_SECRET'] ??
      (paymentsMode === 'live' ? randomBytes(32).toString('hex') : 'dev-only-not-a-real-secret'),
    paymentApprovalTimeoutSeconds: requireInt(raw, 'PAYMENT_APPROVAL_TIMEOUT_SECONDS', 180),
    paymentLateSweepHours: requireInt(raw, 'PAYMENT_LATE_SWEEP_HOURS', 72),
    assistantApiKey: anthropicKey(raw['ANTHROPIC_API_KEY']),
    assistantModel: raw['ANTHROPIC_MODEL']?.trim()
      ? raw['ANTHROPIC_MODEL']!.trim()
      : 'claude-sonnet-5-5',
    assistantRatePerMin: requireInt(raw, 'ASSISTANT_RATE_PER_MIN', 15),
    assistantMonthlyTokenCap: requireInt(raw, 'ASSISTANT_MONTHLY_TOKEN_CAP', 0),
    bannerFreeQuota: requireInt(raw, 'BANNER_FREE_QUOTA', 5),
    bannerPointCost: requireInt(raw, 'BANNER_POINT_COST', 5),
    falApiKey: raw['FAL_KEY']?.trim() ? raw['FAL_KEY']!.trim() : null,
    falModel: raw['FAL_MODEL']?.trim() ? raw['FAL_MODEL']!.trim() : 'fal-ai/flux/schnell',
    corsOrigins: (raw['CORS_ORIGINS'] ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0),
    smsMode: oneOf(raw, 'SMS_MODE', ['mock', 'live'] as const, 'mock'),
    smsGatewayUrl: raw['SMS_GATEWAY_URL']?.trim() ? raw['SMS_GATEWAY_URL']!.trim() : null,
    smsGatewayToken: raw['SMS_GATEWAY_TOKEN']?.trim() ? raw['SMS_GATEWAY_TOKEN']!.trim() : null,
    smsSenderId: raw['SMS_SENDER_ID']?.trim() ? raw['SMS_SENDER_ID']!.trim() : null,
    pushMode: oneOf(raw, 'PUSH_MODE', ['mock', 'live'] as const, 'live'),
    expoAccessToken: raw['EXPO_ACCESS_TOKEN']?.trim() ? raw['EXPO_ACCESS_TOKEN']!.trim() : null,
    alertsSweepMinutes: requireInt(raw, 'ALERTS_SWEEP_MINUTES', 0),
  };

  if (config.nodeEnv === 'production') assertProductionSafe(config, raw);
  return config;
}

/**
 * Production must never run on simulated SMS or payments, even by accident
 * (a forgotten variable). Mock SMS returns the login code in the API response,
 * which would let anyone sign in as any phone number; mock payments grant
 * paid features for free. Staging may still use mocks for testing.
 */
export function assertProductionSafe(
  config: AppConfig,
  raw: Record<string, string | undefined>,
): void {
  const problems: string[] = [];
  if (config.smsMode !== 'live') problems.push('SMS_MODE must be "live"');
  if (config.smsMode === 'live' && (!config.smsGatewayUrl || !config.smsGatewayToken)) {
    problems.push('SMS_GATEWAY_URL and SMS_GATEWAY_TOKEN are required');
  }
  if (config.paymentsMode !== 'live') problems.push('PAYMENTS_MODE must be "live"');
  if ((raw['CHECKOUT_MODE'] ?? 'live').toLowerCase() !== 'live') {
    problems.push('CHECKOUT_MODE must be "live"');
  }
  if (config.corsOrigins.length === 0) problems.push('CORS_ORIGINS must list the site origin(s)');
  if (problems.length > 0) {
    throw new ConfigError(`Unsafe production configuration: ${problems.join('; ')}`);
  }
}

/**
 * Anthropic keys start with "sk-ant-". Anything else (empty, or the
 * placeholder Terraform writes so the task can start) means "assistant off",
 * so a deploy before the owner puts the key keeps the site up (AI-01).
 */
export function anthropicKey(value: string | undefined): string | null {
  const v = value?.trim() ?? '';
  return v.startsWith('sk-ant-') ? v : null;
}

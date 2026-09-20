/**
 * Auth primitives built on Node's crypto only — no native or third-party deps
 * on this build.
 *
 * - OTP codes are hashed with scrypt (memory-hard) before storage, so a database
 *   leak never hands out live login codes. (The schema comment says Argon2id;
 *   scrypt is the dependency-free stand-in here and is documented as such.)
 * - Sessions are opaque random tokens; only their SHA-256 hash is stored (in the
 *   refresh_token table), so the raw token exists only in the httpOnly cookie.
 */

import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

/** A six-digit numeric login code. */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** scrypt hash, self-describing: `scrypt$<salt_b64>$<hash_b64>`. */
export function hashOtpCode(code: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(code, salt, 32);
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
}

/** Constant-time verification of a code against its stored scrypt hash. */
export function verifyOtpCode(code: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1]!, 'base64');
  const expected = Buffer.from(parts[2]!, 'base64');
  if (salt.length === 0 || expected.length === 0) return false;
  const derived = scryptSync(code, salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export interface SessionToken {
  /** Sent to the client, stored only in an httpOnly cookie. */
  readonly raw: string;
  /** Stored server-side (refresh_token.token_hash). */
  readonly hash: string;
}

/** Mint an opaque session token and its stored hash. */
export function newSessionToken(): SessionToken {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashSessionToken(raw) };
}

/** SHA-256 of a raw session token, for lookup. */
export function hashSessionToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

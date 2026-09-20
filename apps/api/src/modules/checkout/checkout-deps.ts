/**
 * Concrete implementations of the CheckoutService dependencies for the running
 * app. These are the real (if simple) behaviours behind the interfaces the
 * service declares — deliberately not stubs.
 */

import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import { cents, type Cents } from '@nhonga/shared';
import type { ShippingQuoter } from './checkout.service.js';

/**
 * Delivery is arranged directly with the seller (the storefront is explicit that
 * the home-delivery fee is "combinada com o vendedor"). The platform therefore
 * quotes a zero marketplace fee and lets the buyer and seller settle delivery
 * off-platform. This keeps the charged total equal to the items subtotal the
 * buyer was shown — no hidden fee is ever added at the final step.
 */
export const offlineDeliveryQuoter: ShippingQuoter = {
  async quote() {
    return { feeCents: cents(0), minDays: 2, maxDays: 5 };
  },
};

/**
 * Human-friendly, unique order numbers: NH-YYMMDD-XXXXX. The suffix is derived
 * from the millisecond clock and a small random tail, which is collision-safe in
 * practice; the UNIQUE constraint on order_number is the real guarantee.
 */
export function makeOrderNumberGenerator(): { next(): Promise<string> } {
  return {
    async next(): Promise<string> {
      const now = new Date();
      const y = String(now.getFullYear()).slice(2);
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const tail = ((now.getTime() % 100000) * 10 + Math.floor(Math.random() * 10))
        .toString()
        .padStart(6, '0')
        .slice(-5);
      return `NH-${y}${m}${d}-${tail}`;
    },
  };
}

/**
 * Real AES-256-GCM field encryption for PII columns (the payer MSISDN).
 *
 * This exists specifically so the checkout never stores a plaintext phone
 * number: a no-op encryptor would look correct in review and quietly leak PII,
 * which is exactly the failure the CheckoutService's comment warns against. In
 * production the key comes from KMS/Secrets Manager; locally it comes from
 * FIELD_ENCRYPTION_KEY. Output format: v1:<iv_b64>:<tag_b64>:<ciphertext_b64>.
 */
export function makeFieldEncryptor(key: Buffer): (plaintext: string) => string {
  if (key.length !== 32) {
    throw new Error('FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).');
  }
  return (plaintext: string): string => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
  };
}

/** Decode FIELD_ENCRYPTION_KEY (base64 or hex) into 32 bytes, or throw. */
export function loadFieldKey(raw: string | undefined): Buffer {
  if (raw === undefined || raw.trim() === '') {
    throw new Error(
      'FIELD_ENCRYPTION_KEY is required to run checkout (32 bytes, base64 or hex). ' +
        'It encrypts the payer phone number before it is stored.',
    );
  }
  const value = raw.trim();
  const asHex = /^[0-9a-fA-F]{64}$/.test(value) ? Buffer.from(value, 'hex') : null;
  const key = asHex ?? Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error('FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).');
  }
  return key;
}

/** A fresh idempotency key when the client did not supply one. */
export function newIdempotencyKey(): string {
  return randomUUID();
}

export type { Cents };
